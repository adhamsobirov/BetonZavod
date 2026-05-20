-- Safe additive migration for smart search metadata, income/expense fields, and barter balance tracking.
-- This migration preserves production CRM data. It only adds optional columns and indexes.

alter table if exists public.finance_transactions
  add column if not exists payment_method text,
  add column if not exists supplier_person text,
  add column if not exists notes text,
  add column if not exists linked_module text,
  add column if not exists linked_record_id text;

alter table if exists public.barter_assets
  add column if not exists starting_barter_value numeric(14,2),
  add column if not exists remaining_barter_balance numeric(14,2),
  add column if not exists progress_percent numeric(5,2);

create index if not exists finance_transactions_type_idx on public.finance_transactions(type);
create index if not exists finance_transactions_category_idx on public.finance_transactions(category);
create index if not exists finance_transactions_payment_method_idx on public.finance_transactions(payment_method);
create index if not exists finance_transactions_linked_module_idx on public.finance_transactions(linked_module);
create index if not exists barter_assets_remaining_amount_idx on public.barter_assets(remaining_amount);
create index if not exists barter_assets_client_remaining_idx on public.barter_assets(client_id, remaining_amount);
