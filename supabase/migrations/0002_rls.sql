-- 0002_rls.sql — Row Level Security
--
-- The API talks to Postgres with the service role key, which bypasses RLS by
-- design: every query is filtered by the caller's organization_id in code.
-- RLS is the second layer, for any other path (Studio, anon key, future
-- Supabase Auth). With RLS enabled and no policy for anon/authenticated the
-- default is DENY, so those roles see nothing even if a key leaks.
--
-- This app authenticates with Firebase, so Supabase's auth.uid() is not
-- meaningful here. If you later move to Supabase Auth, add membership-based
-- policies, e.g.:
--
--   create policy customers_member_select on public.customers
--     for select to authenticated
--     using (exists (
--       select 1 from public.organization_members m
--       where m.organization_id = customers.organization_id
--         and m.user_id = auth.uid()
--     ));

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'organizations', 'organization_members', 'customers', 'leads',
    'conversations', 'sales', 'invoices', 'invoice_items', 'payments',
    'subscriptions', 'usage_records', 'ai_interactions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- service_role keeps full access (it bypasses RLS anyway, but grants must exist
-- for it to reach the tables through PostgREST).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
