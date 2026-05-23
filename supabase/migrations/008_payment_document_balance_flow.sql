-- Safe additive migration for automatic client payment documents.
-- This file preserves production data and only creates a new compatible table/indexes.

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null,
  date timestamptz not null default now(),
  client_id uuid,
  payment_type text not null default 'наличные',
  amount numeric(14,2) not null default 0,
  cash_amount numeric(14,2) not null default 0,
  barter_amount numeric(14,2) not null default 0,
  notes text,
  operator_name text,
  finance_transaction_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_client_id_idx on public.payment_receipts(client_id);
create index if not exists payment_receipts_date_idx on public.payment_receipts(date);
create index if not exists payment_receipts_number_idx on public.payment_receipts(receipt_number);
create index if not exists payment_receipts_finance_transaction_id_idx on public.payment_receipts(finance_transaction_id);

alter table if exists public.payment_receipts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_receipts'
      and policyname = 'authenticated users can read payment receipts'
  ) then
    create policy "authenticated users can read payment receipts" on public.payment_receipts
      for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_receipts'
      and policyname = 'admins can write payment receipts'
  ) then
    create policy "admins can write payment receipts" on public.payment_receipts
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
