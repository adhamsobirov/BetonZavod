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

If Supabase variables are empty, the app works with local seeded/localStorage data. If Supabase variables are set, the app loads and writes CRM data through Supabase.

## Environment Variables

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use only the Supabase anon public key in Vercel. Never commit service-role keys or private secrets.

## Supabase Setup

1. Create a Supabase project.
2. In Authentication settings, enable Anonymous Sign-Ins while the CRM uses its temporary local admin login.
3. Run migrations in order from `supabase/migrations/` in the Supabase SQL editor:
   - `001_initial_schema.sql`
   - `002_current_app_compatibility.sql` only if an older test schema may already exist
4. Copy Project URL into `VITE_SUPABASE_URL`.
5. Copy Project API anon key into `VITE_SUPABASE_ANON_KEY`.

The migration enables RLS and allows authenticated Supabase sessions to manage CRM tables. The frontend signs in anonymously to Supabase after the existing local CRM login, so the anon key is not used as a service key.

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
7. Deploy.

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
git commit -m "Prepare CRM for production deployment"
git push
```
