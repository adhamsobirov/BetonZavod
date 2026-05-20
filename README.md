# Concrete Supply CRM

React/Vite CRM for concrete supply operations: dashboard, clients, concrete delivery, payments, barter assets, client reports, finance, daily reports, invoices, laboratory, analytics, and `Котлован`.

## Stack

- React + Vite + TypeScript
- React Router
- Supabase database/auth/storage-ready client
- Recharts
- Excel export with `exceljs`
- PDF/print documents with `pdfmake`
- Vercel deployment config

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

For production, Supabase variables are required. CRM records are loaded and written through Supabase; localStorage is only a development fallback when Supabase is not configured.

## Environment Variables

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use only the Supabase anon public key in Vercel. Never commit service-role keys or private secrets.

## Supabase Setup

1. Create a Supabase project.
2. In Authentication settings, keep email/password sign-in enabled. Anonymous Sign-Ins are not required.
3. Run migrations in order from `supabase/migrations/` in the Supabase SQL editor:
   - `001_initial_schema.sql`
   - `002_current_app_compatibility.sql` only if an older test schema may already exist
   - `003_secure_admin_auth.sql`
   - `004_mobile_and_kotlovan_polish.sql` if you need the improved Kotlovan project fields/status
   - `005_barter_cement_daily_reports.sql` for barter payment fields, cement inventory, and daily report integrations
4. Create the production admin in Supabase Dashboard → Authentication → Users:
   - Email: `admin@betonregar.com`
   - Password: `000000571A`
   - Confirm email: enabled/confirmed
5. After the Auth user exists, run this SQL once in Supabase SQL Editor:

```sql
insert into public.users_profile (id, full_name, login, role, email)
select id, 'Адхам', 'Adham', 'admin', email
from auth.users
where email = 'admin@betonregar.com'
on conflict (id) do update
set
  full_name = excluded.full_name,
  login = excluded.login,
  role = excluded.role,
  email = excluded.email,
  updated_at = now();
```

6. Copy Project URL into `VITE_SUPABASE_URL`.
7. Copy Project API anon key into `VITE_SUPABASE_ANON_KEY`.

The migration enables RLS so authenticated users can view CRM data, while only users with `users_profile.role = 'admin'` can add, edit, delete, annul, or clear test data. The admin password is stored only in Supabase Auth, never in frontend code.

### Safe Migration Policy

All production migrations must be additive and idempotent:

- Use `CREATE TABLE IF NOT EXISTS`.
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Never run `DROP TABLE`, `TRUNCATE`, or `DELETE` against production CRM records.
- Policy changes may replace RLS policies, but must not remove business data.
- Before future deploys, run new migrations manually in Supabase and verify row counts.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Vercel Deployment

The project includes `vercel.json` with Vite build settings and SPA rewrites.

1. Push this repository to GitHub.
2. In Vercel, choose **Add New Project** and import the GitHub repository.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy or redeploy after the migration and environment variables are ready.

Admin login after deployment:

- Login: `Adham`
- Password: `000000571A`

## Domain Later: betonregar.com

Do not attach the domain until the Vercel deployment is verified.

When ready:

1. Open Vercel project → Settings → Domains.
2. Add `betonregar.com`.
3. Add `www.betonregar.com` if needed.
4. Follow Vercel’s DNS instructions:
   - Apex/root domain usually needs an `A` record to Vercel’s IP.
   - `www` usually needs a `CNAME` to Vercel.
5. In the DNS provider for `betonregar.com`, update records exactly as Vercel shows.
6. Wait for DNS verification and SSL certificate provisioning.
7. Set the preferred production domain in Vercel after both apex and `www` are valid.

## GitHub Push

```bash
git init
git add .
git commit -m "Prepare CRM for production deployment"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

If the repository already has Git configured, use:

```bash
git status
git add .
git commit -m "Improve mobile UI and secure admin auth"
git push
```

Vercel is connected to GitHub, so it will auto-deploy after `git push`.

## Production Data Verification

After migration and deployment:

1. In Supabase Table Editor, check row counts for `clients`, `client_reports`, `finance_transactions`, `barter_assets`, `daily_reports`, `invoices`, `lab_reports`, and `excavation_reports`.
2. Log in at the site with `Adham`.
3. Open client, finance, invoice, lab, and excavation pages and confirm existing records are visible.
4. Refresh the browser and confirm the same data remains.
5. Create a small test record only if needed, then confirm it appears in Supabase and survives refresh.
