-- Safe production auth/role migration for Beton Zavod CRM.
-- This migration is idempotent and does not remove CRM data.
-- It only adds missing auth/profile fields, functions, indexes, and RLS policies.

alter table if exists public.users_profile
  add column if not exists login text;

create unique index if not exists users_profile_login_key
  on public.users_profile (lower(login))
  where login is not null;

create or replace function public.login_email_for_username(p_login text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.users_profile
  where lower(login) = lower(p_login)
  limit 1;
$$;

revoke all on function public.login_email_for_username(text) from public;
grant execute on function public.login_email_for_username(text) to anon, authenticated;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.users_profile
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

alter table if exists public.users_profile enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.client_reports enable row level security;
alter table if exists public.barter_assets enable row level security;
alter table if exists public.finance_transactions enable row level security;
alter table if exists public.daily_reports enable row level security;
alter table if exists public.daily_report_items enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.lab_reports enable row level security;
alter table if exists public.excavation_reports enable row level security;
alter table if exists public.excavation_payments enable row level security;
alter table if exists public.activity_logs enable row level security;

drop policy if exists "authenticated users can manage crm data" on public.clients;
drop policy if exists "authenticated users can manage client reports" on public.client_reports;
drop policy if exists "authenticated users can manage barter assets" on public.barter_assets;
drop policy if exists "authenticated users can manage finance" on public.finance_transactions;
drop policy if exists "authenticated users can manage daily reports" on public.daily_reports;
drop policy if exists "authenticated users can manage daily report items" on public.daily_report_items;
drop policy if exists "authenticated users can manage invoices" on public.invoices;
drop policy if exists "authenticated users can manage lab reports" on public.lab_reports;
drop policy if exists "authenticated users can manage excavation reports" on public.excavation_reports;
drop policy if exists "authenticated users can manage excavation payments" on public.excavation_payments;
drop policy if exists "authenticated users can read activity" on public.activity_logs;
drop policy if exists "authenticated users can write activity" on public.activity_logs;
drop policy if exists "users can read own profile" on public.users_profile;
drop policy if exists "users can update own profile" on public.users_profile;

drop policy if exists "authenticated users can read clients" on public.clients;
drop policy if exists "admins can write clients" on public.clients;
drop policy if exists "authenticated users can read client reports" on public.client_reports;
drop policy if exists "admins can write client reports" on public.client_reports;
drop policy if exists "authenticated users can read barter assets" on public.barter_assets;
drop policy if exists "admins can write barter assets" on public.barter_assets;
drop policy if exists "authenticated users can read finance transactions" on public.finance_transactions;
drop policy if exists "admins can write finance transactions" on public.finance_transactions;
drop policy if exists "authenticated users can read daily reports" on public.daily_reports;
drop policy if exists "admins can write daily reports" on public.daily_reports;
drop policy if exists "authenticated users can read daily report items" on public.daily_report_items;
drop policy if exists "admins can write daily report items" on public.daily_report_items;
drop policy if exists "authenticated users can read invoices" on public.invoices;
drop policy if exists "admins can write invoices" on public.invoices;
drop policy if exists "authenticated users can read lab reports" on public.lab_reports;
drop policy if exists "admins can write lab reports" on public.lab_reports;
drop policy if exists "authenticated users can read excavation reports" on public.excavation_reports;
drop policy if exists "admins can write excavation reports" on public.excavation_reports;
drop policy if exists "authenticated users can read excavation payments" on public.excavation_payments;
drop policy if exists "admins can write excavation payments" on public.excavation_payments;
drop policy if exists "authenticated users can read activity logs" on public.activity_logs;
drop policy if exists "admins can write activity logs" on public.activity_logs;
drop policy if exists "users can read own profile secure" on public.users_profile;
drop policy if exists "admins can read all profiles" on public.users_profile;
drop policy if exists "admins can write profiles" on public.users_profile;

create policy "users can read own profile secure" on public.users_profile
  for select to authenticated using (auth.uid() = id);
create policy "admins can read all profiles" on public.users_profile
  for select to authenticated using (public.is_admin());
create policy "admins can write profiles" on public.users_profile
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read clients" on public.clients for select to authenticated using (true);
create policy "admins can write clients" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read client reports" on public.client_reports for select to authenticated using (true);
create policy "admins can write client reports" on public.client_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read barter assets" on public.barter_assets for select to authenticated using (true);
create policy "admins can write barter assets" on public.barter_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read finance transactions" on public.finance_transactions for select to authenticated using (true);
create policy "admins can write finance transactions" on public.finance_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read daily reports" on public.daily_reports for select to authenticated using (true);
create policy "admins can write daily reports" on public.daily_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read daily report items" on public.daily_report_items for select to authenticated using (true);
create policy "admins can write daily report items" on public.daily_report_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read invoices" on public.invoices for select to authenticated using (true);
create policy "admins can write invoices" on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read lab reports" on public.lab_reports for select to authenticated using (true);
create policy "admins can write lab reports" on public.lab_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read excavation reports" on public.excavation_reports for select to authenticated using (true);
create policy "admins can write excavation reports" on public.excavation_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read excavation payments" on public.excavation_payments for select to authenticated using (true);
create policy "admins can write excavation payments" on public.excavation_payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users can read activity logs" on public.activity_logs for select to authenticated using (true);
create policy "admins can write activity logs" on public.activity_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
