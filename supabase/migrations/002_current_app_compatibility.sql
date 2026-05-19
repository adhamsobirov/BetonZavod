do $$ begin
  alter type crm_status add value if not exists 'annulled';
exception when duplicate_object then null;
end $$;

alter table if exists clients
  add column if not exists password text,
  add column if not exists contract_total numeric(14,2) not null default 0,
  add column if not exists cash_available numeric(14,2) not null default 0,
  add column if not exists total_supplied_m3 numeric(12,2) not null default 0,
  add column if not exists total_paid numeric(14,2) not null default 0,
  add column if not exists total_barter_value numeric(14,2) not null default 0,
  add column if not exists annulled boolean not null default false;

alter table if exists client_reports
  add column if not exists annulled boolean not null default false;

alter table if exists barter_assets
  add column if not exists owned_at timestamptz,
  add column if not exists source_client_name text;

alter table if exists finance_transactions
  add column if not exists annulled boolean not null default false;

alter table if exists daily_reports
  add column if not exists annulled boolean not null default false;

alter table if exists invoices
  add column if not exists delivery_ids jsonb not null default '[]'::jsonb;

alter table if exists lab_reports
  add column if not exists delivery_id uuid references client_reports(id) on delete set null,
  add column if not exists sample_date date,
  add column if not exists test_date date,
  add column if not exists temperature numeric(8,2),
  add column if not exists cement_amount numeric(12,2),
  add column if not exists sand_amount numeric(12,2),
  add column if not exists gravel_amount numeric(12,2),
  add column if not exists water_amount numeric(12,2),
  add column if not exists notes text,
  add column if not exists annulled boolean not null default false;

update lab_reports
set sample_date = coalesce(sample_date, date),
    test_date = coalesce(test_date, date)
where sample_date is null or test_date is null;

alter table if exists lab_reports
  alter column sample_date set not null,
  alter column test_date set not null,
  alter column status drop default,
  alter column status type text using status::text,
  alter column status set default 'pending';

alter table if exists excavation_reports
  add column if not exists annulled boolean not null default false;

create index if not exists finance_transactions_client_id_idx on finance_transactions(client_id);
create index if not exists lab_reports_client_id_idx on lab_reports(client_id);

drop policy if exists "authenticated users can write activity" on activity_logs;
create policy "authenticated users can write activity" on activity_logs for insert to authenticated with check (true);
