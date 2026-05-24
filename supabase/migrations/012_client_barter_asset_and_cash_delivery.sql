-- Safe additive migration for cash-received delivery flow and initial client barter assets.
-- This migration never drops, truncates, or deletes production data.

alter table if exists public.client_reports
  add column if not exists cash_received_now numeric not null default 0;

alter table if exists public.barter_assets
  add column if not exists contract_number text;

create index if not exists idx_client_reports_cash_received_now
  on public.client_reports (cash_received_now);

create index if not exists idx_barter_assets_contract_number
  on public.barter_assets (contract_number);
