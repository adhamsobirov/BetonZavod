create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin', 'manager', 'accountant', 'operator');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type crm_status as enum ('active', 'pending', 'debt', 'archived', 'paid', 'unpaid', 'completed', 'in_progress', 'annulled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type lab_status as enum ('pending', 'passed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type finance_type as enum ('income', 'expense', 'barter');
exception when duplicate_object then null;
end $$;

create table if not exists users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'operator',
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text not null unique,
  password text,
  phone text,
  balance numeric(14,2) not null default 0,
  contract_type text not null default '100% cash / Без бартера',
  contract_total numeric(14,2) not null default 0,
  cash_percent numeric(5,2) not null default 100,
  barter_percent numeric(5,2) not null default 0,
  cash_available numeric(14,2) not null default 0,
  total_supplied_m3 numeric(12,2) not null default 0,
  total_paid numeric(14,2) not null default 0,
  total_barter_value numeric(14,2) not null default 0,
  status crm_status not null default 'active',
  archived boolean not null default false,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  object_name text not null,
  concrete_grade text not null,
  volume_m3 numeric(12,2) not null default 0,
  amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  barter_amount numeric(14,2) not null default 0,
  cash_amount numeric(14,2) not null default 0,
  transport_cost numeric(14,2) not null default 0,
  trip_count integer not null default 0,
  comment text,
  barter_asset_allocations jsonb not null default '[]'::jsonb,
  status crm_status not null default 'active',
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists barter_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null check (type in ('apartment', 'car', 'land', 'equipment', 'other')),
  asset_name text not null,
  market_value numeric(14,2) not null,
  cost_price numeric(14,2) not null default 0,
  used_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'partial', 'written_off', 'owned')),
  owned_at timestamptz,
  source_client_name text,
  photos jsonb not null default '[]'::jsonb,
  comment text,
  apartment_number text,
  building text,
  block text,
  floor text,
  area_m2 numeric(12,2),
  rooms integer,
  address text,
  car_make text,
  car_model text,
  car_year text,
  license_plate text,
  vin text,
  mileage text,
  color text,
  condition text,
  land_area text,
  land_purpose text,
  cadastral_number text,
  equipment_name text,
  equipment_model text,
  equipment_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  date date not null,
  category text not null,
  type finance_type not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  status crm_status not null default 'paid',
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  items jsonb not null default '[]'::jsonb,
  cement_t numeric(12,2) not null default 0,
  gravel_t numeric(12,2) not null default 0,
  sand_t numeric(12,2) not null default 0,
  additives_l numeric(12,2) not null default 0,
  salary_expense numeric(14,2) not null default 0,
  fuel_expense numeric(14,2) not null default 0,
  saved_at timestamptz,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_report_items (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references daily_reports(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  object_name text not null,
  concrete_grade text not null,
  volume_m3 numeric(12,2) not null default 0,
  price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  number text not null unique,
  delivery_ids jsonb not null default '[]'::jsonb,
  date date not null,
  due_date date not null,
  amount numeric(14,2) not null default 0,
  status crm_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lab_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  delivery_id uuid references client_reports(id) on delete set null,
  date date not null,
  sample_date date not null,
  test_date date not null,
  concrete_grade text not null,
  object_name text not null,
  slump text,
  temperature numeric(8,2),
  cement_amount numeric(12,2),
  sand_amount numeric(12,2),
  gravel_amount numeric(12,2),
  water_amount numeric(12,2),
  notes text,
  strength_mpa numeric(8,2) not null default 0,
  status lab_status not null default 'pending',
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists excavation_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  object_name text not null,
  client_name text not null,
  client_phone text,
  location text,
  work_type text not null,
  excavation_m3 numeric(12,2) not null default 0,
  backfill_m3 numeric(12,2) not null default 0,
  price_per_m3 numeric(14,2) not null default 0,
  trip_count integer not null default 0,
  price_per_trip numeric(14,2) not null default 0,
  machinery text,
  driver text,
  workers text,
  worker_salary numeric(14,2) not null default 0,
  diesel_liters numeric(12,2) not null default 0,
  diesel_price numeric(14,2) not null default 0,
  machinery_rent numeric(14,2) not null default 0,
  other_expenses numeric(14,2) not null default 0,
  received_payment numeric(14,2) not null default 0,
  comment text,
  status crm_status not null default 'active',
  archived boolean not null default false,
  annulled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists excavation_payments (
  id uuid primary key default gen_random_uuid(),
  excavation_report_id uuid not null references excavation_reports(id) on delete cascade,
  date date not null,
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'cash',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id) on delete set null,
  module text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_status_idx on clients(status);
create index if not exists client_reports_client_id_idx on client_reports(client_id);
create index if not exists client_reports_date_idx on client_reports(date);
create index if not exists client_reports_status_idx on client_reports(status);
create index if not exists barter_assets_client_id_idx on barter_assets(client_id);
create index if not exists barter_assets_status_idx on barter_assets(status);
create index if not exists finance_transactions_client_id_idx on finance_transactions(client_id);
create index if not exists finance_transactions_date_idx on finance_transactions(date);
create index if not exists finance_transactions_status_idx on finance_transactions(status);
create index if not exists daily_reports_date_idx on daily_reports(date);
create index if not exists daily_report_items_daily_report_id_idx on daily_report_items(daily_report_id);
create index if not exists invoices_client_id_idx on invoices(client_id);
create index if not exists invoices_status_idx on invoices(status);
create index if not exists lab_reports_client_id_idx on lab_reports(client_id);
create index if not exists lab_reports_date_idx on lab_reports(date);
create index if not exists lab_reports_status_idx on lab_reports(status);
create index if not exists excavation_reports_date_idx on excavation_reports(date);
create index if not exists excavation_reports_status_idx on excavation_reports(status);
create index if not exists excavation_payments_excavation_report_id_idx on excavation_payments(excavation_report_id);

alter table users_profile enable row level security;
alter table clients enable row level security;
alter table client_reports enable row level security;
alter table barter_assets enable row level security;
alter table finance_transactions enable row level security;
alter table daily_reports enable row level security;
alter table daily_report_items enable row level security;
alter table invoices enable row level security;
alter table lab_reports enable row level security;
alter table excavation_reports enable row level security;
alter table excavation_payments enable row level security;
alter table activity_logs enable row level security;

drop policy if exists "authenticated users can manage crm data" on clients;
drop policy if exists "authenticated users can manage client reports" on client_reports;
drop policy if exists "authenticated users can manage barter assets" on barter_assets;
drop policy if exists "authenticated users can manage finance" on finance_transactions;
drop policy if exists "authenticated users can manage daily reports" on daily_reports;
drop policy if exists "authenticated users can manage daily report items" on daily_report_items;
drop policy if exists "authenticated users can manage invoices" on invoices;
drop policy if exists "authenticated users can manage lab reports" on lab_reports;
drop policy if exists "authenticated users can manage excavation reports" on excavation_reports;
drop policy if exists "authenticated users can manage excavation payments" on excavation_payments;
drop policy if exists "authenticated users can read activity" on activity_logs;
drop policy if exists "authenticated users can write activity" on activity_logs;
drop policy if exists "users can read own profile" on users_profile;
drop policy if exists "users can update own profile" on users_profile;

create policy "authenticated users can manage crm data" on clients for all to authenticated using (true) with check (true);
create policy "authenticated users can manage client reports" on client_reports for all to authenticated using (true) with check (true);
create policy "authenticated users can manage barter assets" on barter_assets for all to authenticated using (true) with check (true);
create policy "authenticated users can manage finance" on finance_transactions for all to authenticated using (true) with check (true);
create policy "authenticated users can manage daily reports" on daily_reports for all to authenticated using (true) with check (true);
create policy "authenticated users can manage daily report items" on daily_report_items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage invoices" on invoices for all to authenticated using (true) with check (true);
create policy "authenticated users can manage lab reports" on lab_reports for all to authenticated using (true) with check (true);
create policy "authenticated users can manage excavation reports" on excavation_reports for all to authenticated using (true) with check (true);
create policy "authenticated users can manage excavation payments" on excavation_payments for all to authenticated using (true) with check (true);
create policy "authenticated users can read activity" on activity_logs for select to authenticated using (true);
create policy "authenticated users can write activity" on activity_logs for insert to authenticated with check (true);
create policy "users can read own profile" on users_profile for select to authenticated using (auth.uid() = id);
create policy "users can update own profile" on users_profile for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
