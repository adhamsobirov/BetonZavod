-- Safe additive migration for the accounting specification.
-- Preserves production data. Uses only CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

create table if not exists public.accounting_debts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receivable', 'payable')),
  counterparty text not null,
  client_id uuid,
  source_module text,
  source_record_id text,
  date date not null,
  due_date date,
  amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  status text not null default 'open',
  notes text,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_repayments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid,
  date date not null,
  amount numeric(14,2) not null default 0,
  direction text not null check (direction in ('receivable', 'payable')),
  notes text,
  finance_transaction_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.raw_material_receipts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  supplier text not null,
  material text not null,
  quantity numeric(14,3) not null default 0,
  unit text not null default 'т',
  price numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  status text not null default 'paid',
  notes text,
  debt_id uuid,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_debts_type_idx on public.accounting_debts(type);
create index if not exists accounting_debts_status_idx on public.accounting_debts(status);
create index if not exists accounting_debts_date_idx on public.accounting_debts(date);
create index if not exists accounting_debts_client_id_idx on public.accounting_debts(client_id);
create index if not exists accounting_debts_counterparty_idx on public.accounting_debts(counterparty);
create index if not exists debt_repayments_debt_id_idx on public.debt_repayments(debt_id);
create index if not exists debt_repayments_date_idx on public.debt_repayments(date);
create index if not exists raw_material_receipts_date_idx on public.raw_material_receipts(date);
create index if not exists raw_material_receipts_status_idx on public.raw_material_receipts(status);
create index if not exists raw_material_receipts_supplier_idx on public.raw_material_receipts(supplier);

alter table if exists public.accounting_debts enable row level security;
alter table if exists public.debt_repayments enable row level security;
alter table if exists public.raw_material_receipts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounting_debts' and policyname = 'authenticated users can read accounting debts') then
    create policy "authenticated users can read accounting debts" on public.accounting_debts for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_repayments' and policyname = 'authenticated users can read debt repayments') then
    create policy "authenticated users can read debt repayments" on public.debt_repayments for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'raw_material_receipts' and policyname = 'authenticated users can read raw material receipts') then
    create policy "authenticated users can read raw material receipts" on public.raw_material_receipts for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounting_debts' and policyname = 'admins can write accounting debts') then
    create policy "admins can write accounting debts" on public.accounting_debts for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_repayments' and policyname = 'admins can write debt repayments') then
    create policy "admins can write debt repayments" on public.debt_repayments for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'raw_material_receipts' and policyname = 'admins can write raw material receipts') then
    create policy "admins can write raw material receipts" on public.raw_material_receipts for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
