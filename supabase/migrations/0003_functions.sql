-- 0003_functions.sql — transactional helpers used by the API
--
-- Each function is SECURITY DEFINER with a fixed search_path and execute
-- revoked from anon/authenticated, so it can only be called with the service
-- role used by the API.

-- ---------------------------------------------------------------------------
-- bootstrap_account: first sign-in creates user + organization + membership in
-- one transaction. Idempotent, safe to call on every session.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_account(
  p_firebase_uid text,
  p_email text,
  p_display_name text
)
returns table (
  user_id uuid,
  organization_id uuid,
  organization_name text,
  role text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_org_name text;
  v_role text;
begin
  if p_firebase_uid is null or btrim(p_firebase_uid) = '' then
    raise exception 'firebase uid is required';
  end if;

  -- Two concurrent first sign-ins for one user would otherwise both see "no
  -- organization" and each create one. The lock serialises them per user.
  perform pg_advisory_xact_lock(hashtext(p_firebase_uid));

  insert into public.users (firebase_uid, email, display_name)
  values (
    p_firebase_uid,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_display_name, '')), '')
  )
  on conflict (firebase_uid) do update
    set email = coalesce(excluded.email, public.users.email),
        display_name = coalesce(excluded.display_name, public.users.display_name)
  returning id into v_user_id;

  select om.organization_id, om.role, o.name
    into v_org_id, v_role, v_org_name
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = v_user_id
  order by om.created_at asc
  limit 1;

  if v_org_id is null then
    v_org_name := coalesce(
      nullif(btrim(coalesce(p_display_name, '')), '') || ' business',
      'My business'
    );

    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'owner');

    v_role := 'owner';
  end if;

  return query select v_user_id, v_org_id, v_org_name, v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_invoice_with_items: header + line items atomically. Totals are
-- computed here, never accepted from the client.
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice_with_items(
  p_organization_id uuid,
  p_customer_id uuid,
  p_number text,
  p_currency text,
  p_issue_date date,
  p_due_date date,
  p_notes text,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_number text;
  v_subtotal numeric(14, 2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'invoice requires at least one item';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id and organization_id = p_organization_id
  ) then
    raise exception 'customer not found in organization';
  end if;

  select coalesce(sum((item->>'quantity')::numeric * (item->>'unitPrice')::numeric), 0)
    into v_subtotal
  from jsonb_array_elements(p_items) as item;

  v_number := coalesce(
    nullif(btrim(p_number), ''),
    'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  );

  insert into public.invoices (
    organization_id, customer_id, number, status, currency,
    subtotal, total, amount_paid, issue_date, due_date, notes
  )
  values (
    p_organization_id, p_customer_id, v_number, 'draft',
    upper(coalesce(p_currency, 'UZS')),
    v_subtotal, v_subtotal, 0,
    coalesce(p_issue_date, current_date),
    coalesce(p_due_date, current_date),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_invoice;

  insert into public.invoice_items (invoice_id, description, quantity, unit_price, line_total)
  select
    v_invoice.id,
    item->>'description',
    (item->>'quantity')::numeric,
    (item->>'unitPrice')::numeric,
    round((item->>'quantity')::numeric * (item->>'unitPrice')::numeric, 2)
  from jsonb_array_elements(p_items) as item;

  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_payment: idempotent payment reconciliation with a state machine.
--
--   * (provider, provider_payment_id) is unique, so duplicate callbacks are
--     recorded once and reported as `duplicate: true`,
--   * a pending/failed payment may be advanced to succeeded (Payme creates the
--     transaction first and performs it in a second callback); anything else
--     is reported as `state_conflict: true` and changes nothing,
--   * an invoice only becomes `paid` when amount_paid >= total, and only this
--     function changes that — no API route accepts `status: "paid"`.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_provider text,
  p_provider_payment_id text,
  p_invoice_id uuid,
  p_amount numeric,
  p_currency text,
  p_status text,
  p_raw jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_payment public.payments;
  v_amount numeric(14, 2);
begin
  if p_status not in ('pending', 'succeeded', 'failed', 'cancelled') then
    raise exception 'invalid payment status %', p_status;
  end if;

  if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
    return jsonb_build_object('found', false);
  end if;

  -- Lock the invoice first so concurrent callbacks for one invoice serialise.
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  v_amount := round(greatest(coalesce(p_amount, 0), 0), 2);

  select * into v_payment
    from public.payments
   where provider = p_provider
     and provider_payment_id = p_provider_payment_id
   for update;

  if found then
    -- Settled payments are final: a provider may re-deliver, never downgrade.
    if v_payment.status in ('succeeded', 'cancelled') then
      return jsonb_build_object(
        'found', true,
        'duplicate', v_payment.status = p_status,
        'state_conflict', v_payment.status <> p_status,
        'payment_id', v_payment.id,
        'invoice_status', v_invoice.status,
        'amount_paid', v_invoice.amount_paid,
        'total', v_invoice.total
      );
    end if;

    if v_payment.status = p_status then
      return jsonb_build_object(
        'found', true,
        'duplicate', true,
        'state_conflict', false,
        'payment_id', v_payment.id,
        'invoice_status', v_invoice.status,
        'amount_paid', v_invoice.amount_paid,
        'total', v_invoice.total
      );
    end if;

    update public.payments
       set status = p_status,
           amount = case when v_amount > 0 then v_amount else amount end,
           currency = case
                        when nullif(upper(btrim(coalesce(p_currency, ''))), '') is null then currency
                        else upper(btrim(p_currency))
                      end,
           raw_payload = coalesce(p_raw, raw_payload),
           updated_at = now()
     where id = v_payment.id
     returning * into v_payment;
  else
    insert into public.payments (
      organization_id, invoice_id, provider, provider_payment_id,
      amount, currency, status, raw_payload
    )
    values (
      v_invoice.organization_id, p_invoice_id, p_provider, p_provider_payment_id,
      v_amount, upper(coalesce(p_currency, 'UZS')), p_status, p_raw
    )
    returning * into v_payment;
  end if;

  -- Only a succeeded payment moves money. Reaching this line means the row was
  -- newly inserted or just transitioned, so it credits exactly once.
  if p_status = 'succeeded' then
    update public.invoices
       set amount_paid = round(amount_paid + v_payment.amount, 2),
           status = case
                      when round(amount_paid + v_payment.amount, 2) >= total then 'paid'
                      else 'partial'
                    end,
           paid_at = case
                       when round(amount_paid + v_payment.amount, 2) >= total then now()
                       else paid_at
                     end,
           updated_at = now()
     where id = p_invoice_id
     returning * into v_invoice;
  end if;

  return jsonb_build_object(
    'found', true,
    'duplicate', false,
    'state_conflict', false,
    'payment_id', v_payment.id,
    'invoice_status', v_invoice.status,
    'amount_paid', v_invoice.amount_paid,
    'total', v_invoice.total
  );
end;
$$;

-- Only the API's service role may execute these.
revoke all on function public.bootstrap_account(text, text, text) from public, anon, authenticated;
revoke all on function public.create_invoice_with_items(uuid, uuid, text, text, date, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_payment(text, text, uuid, numeric, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.bootstrap_account(text, text, text) to service_role;
grant execute on function public.create_invoice_with_items(uuid, uuid, text, text, date, date, text, jsonb) to service_role;
grant execute on function public.record_payment(text, text, uuid, numeric, text, text, jsonb) to service_role;
