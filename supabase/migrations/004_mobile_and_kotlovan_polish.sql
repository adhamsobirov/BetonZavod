-- Safe additive migration for Kotlovan project-level fields.
-- No CRM data is deleted, truncated, dropped, or overwritten.

do $$
begin
  alter type public.crm_status add value if not exists 'paused';
exception
  when duplicate_object then null;
end $$;

alter table if exists public.excavation_reports
  add column if not exists total_volume_m3 numeric(12,2),
  add column if not exists completed_volume_m3 numeric(12,2),
  add column if not exists paid_amount numeric(14,2),
  add column if not exists expenses numeric(14,2);

create index if not exists excavation_reports_client_name_idx
  on public.excavation_reports (client_name);

create index if not exists excavation_reports_object_name_idx
  on public.excavation_reports (object_name);
