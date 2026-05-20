-- Safe additive migration for barter payment fields, cement inventory, and daily report integration.
-- This file preserves production CRM data and only adds fields/table/indexes/policies.

alter table if exists public.barter_assets
  add column if not exists linked_contract_amount numeric(14,2),
  add column if not exists cash_paid numeric(14,2) not null default 0,
  add column if not exists barter_value numeric(14,2),
  add column if not exists total_paid_value numeric(14,2),
  add column if not exists remaining_debt numeric(14,2),
  add column if not exists asset_status text not null default 'accepted',
  add column if not exists notes text;

create table if not exists public.cement_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('incoming', 'usage')),
  supplier text,
  tons numeric(12,2) not null default 0,
  price_per_ton numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  reason text,
  project text,
  client_id uuid,
  client_name text,
  notes text,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists barter_assets_asset_status_idx on public.barter_assets(asset_status);
create index if not exists cement_movements_date_idx on public.cement_movements(date);
create index if not exists cement_movements_type_idx on public.cement_movements(type);
create index if not exists cement_movements_client_id_idx on public.cement_movements(client_id);

alter table if exists public.cement_movements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cement_movements'
      and policyname = 'authenticated users can read cement movements'
  ) then
    create policy "authenticated users can read cement movements" on public.cement_movements
      for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cement_movements'
      and policyname = 'admins can write cement movements'
  ) then
    create policy "admins can write cement movements" on public.cement_movements
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
