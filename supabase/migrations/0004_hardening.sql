-- 0004_hardening.sql — additive database hardening
--
-- This migration only adds indexes, one constraint and privilege revokes, and
-- replaces three function bodies. It never drops a table, a column or a row,
-- and it is safe to apply after 0001-0003.

-- ---------------------------------------------------------------------------
-- 1. Foreign-key indexes
--
-- Postgres does not index the referencing side of a foreign key. Without these,
-- deleting a customer scans the entire invoices table (its FK is
-- ON DELETE RESTRICT), and deleting a customer/sale/user scans sales,
-- conversations and ai_interactions.
-- ---------------------------------------------------------------------------
create index if not exists invoices_customer_idx on public.invoices (customer_id);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists conversations_customer_idx on public.conversations (customer_id);
create index if not exists ai_interactions_user_idx on public.ai_interactions (user_id);
create index if not exists payments_organization_id_idx on public.payments (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Tenant-safe customer reference (defence in depth)
--
-- The API already checks that a customer belongs to the caller's organization
-- before linking it. This composite key makes Postgres refuse the link too, so
-- a future code path that forgets the check cannot create a cross-tenant
-- reference. The single-column FK above stays for ON DELETE RESTRICT.
-- ---------------------------------------------------------------------------
create unique index if not exists customers_organization_id_id_key
  on public.customers (organization_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_customer_same_org'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_customer_same_org
      foreign key (organization_id, customer_id)
      references public.customers (organization_id, id)
      on delete restrict;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Closed by default for anon/authenticated
--
-- 0002 revoked privileges on the tables that existed then. These two
-- statements cover the schema and any table added later, so a new migration
-- cannot accidentally hand the Data API a readable table.
-- ---------------------------------------------------------------------------
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trigger function hardening
--
-- The function is SECURITY INVOKER, but a fixed search_path removes any doubt
-- about which now() is called if the caller's search_path is unusual.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. create_invoice_with_items: subtotal must equal the sum of line totals
--
-- 0003 summed unrounded quantity * unitPrice while each line_total was rounded
-- to 2 decimals, so a 3-line invoice could store a subtotal one cent off the
-- sum of its items. Both sides now use the same rounding.
--
-- create or replace keeps the existing ACLs (execute still revoked from
-- public/anon/authenticated, granted to service_role).
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

  -- Same expression as line_total below, so the parts add up to the whole.
  select coalesce(
           sum(round((item->>'quantity')::numeric * (item->>'unitPrice')::numeric, 2)),
           0
         )
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
-- 6. record_payment: refuse an amount the column cannot hold
--
-- numeric(14,2) overflows on anything above ~1e12, which raised an exception
-- and turned a malformed provider callback into a 500 retry loop. The API also
-- caps the value, but the check belongs where the column lives.
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

  -- Clamp instead of overflowing: the value is still validated by the API.
  v_amount := least(
    round(greatest(coalesce(p_amount, 0), 0), 2),
    999999999999.99::numeric
  );

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
