-- 0001_init.sql — SavdoPilot AI schema
--
-- Apply with the Supabase CLI (`supabase db push`) or the SQL editor.
-- Do not run this against a database you have not configured: it creates
-- tables and cannot be undone from the application.

create extension if not exists "pgcrypto";

-- Reusable updated_at trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity mirrors Firebase Auth. The Firebase uid is the only external id we
-- trust; the local uuid is what every table references.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My business',
  currency text not null default 'UZS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_currency_check check (char_length(currency) = 3)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- Business data. Every table is scoped by organization_id.
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text,
  email text,
  status text not null default 'new'
    check (status in ('new', 'active', 'vip', 'inactive')),
  notes text,
  telegram text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_org_created_idx
  on public.customers (organization_id, created_at desc);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text,
  email text,
  source text not null default 'manual'
    check (source in ('manual', 'telegram', 'instagram', 'web', 'ai')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_org_created_idx
  on public.leads (organization_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null default 'manual'
    check (channel in ('manual', 'telegram', 'instagram', 'web', 'ai')),
  direction text not null default 'outbound'
    check (direction in ('inbound', 'outbound')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists conversations_org_created_idx
  on public.conversations (organization_id, created_at desc);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  total numeric(14, 2) not null default 0 check (total >= 0),
  currency text not null default 'UZS' check (char_length(currency) = 3),
  status text not null default 'completed'
    check (status in ('draft', 'completed', 'cancelled')),
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_org_sold_idx
  on public.sales (organization_id, sold_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  number text not null check (char_length(number) between 1 and 64),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'overdue', 'partial', 'paid')),
  currency text not null default 'UZS' check (char_length(currency) = 3),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  issue_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index if not exists invoices_org_created_idx
  on public.invoices (organization_id, created_at desc);
create index if not exists invoices_org_status_idx
  on public.invoices (organization_id, status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null check (provider in ('click', 'payme', 'uzum', 'stripe')),
  provider_payment_id text not null,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'UZS' check (char_length(currency) = 3),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotency: a provider callback can be delivered more than once.
  unique (provider, provider_payment_id)
);
create index if not exists payments_invoice_idx on public.payments (invoice_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null check (char_length(metric) between 1 and 64),
  quantity integer not null default 1 check (quantity >= 0),
  created_at timestamptz not null default now()
);
create index if not exists usage_records_org_created_idx
  on public.usage_records (organization_id, created_at desc);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  feature text not null check (feature in ('chat', 'message', 'insights', 'reminder')),
  model text,
  status text not null default 'ok' check (status in ('ok', 'error')),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);
create index if not exists ai_interactions_org_created_idx
  on public.ai_interactions (organization_id, created_at desc);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array['users', 'organizations', 'customers', 'leads', 'sales', 'invoices', 'payments', 'subscriptions']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;
