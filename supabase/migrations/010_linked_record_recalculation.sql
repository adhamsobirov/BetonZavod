-- Safe additive migration for linked-record recalculation support.
-- This migration never drops, truncates, or deletes production data.

alter table if exists public.client_reports
  add column if not exists recalculated_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table if exists public.raw_material_receipts
  add column if not exists recalculated_at timestamptz;

alter table if exists public.debt_repayments
  add column if not exists updated_at timestamptz,
  add column if not exists annulled boolean not null default false;

create index if not exists idx_finance_transactions_linked_record
  on public.finance_transactions (linked_module, linked_record_id);

create index if not exists idx_accounting_debts_source_record
  on public.accounting_debts (source_module, source_record_id);

create index if not exists idx_raw_material_receipts_debt_id
  on public.raw_material_receipts (debt_id);

create index if not exists idx_debt_repayments_debt_id
  on public.debt_repayments (debt_id);
