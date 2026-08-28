# Cloudflare Pages deployment

MnemoNotes is a static Vite + React app. Cloudflare Pages hosts the frontend only; Supabase handles auth, database, RLS, and Edge Functions.

## Build settings

| Field | Value |
|--------|--------|
| Framework preset | React (Vite) |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| Root directory | *(leave blank — repo root)* |

Cloudflare detects `pnpm-lock.yaml` and uses pnpm automatically. If the build fails with a pnpm error, add:

- `PNPM_VERSION` = `9` (or your local version)
- `NODE_VERSION` = `20` (if Node version issues appear)

## Environment variables

Add these under **Environment variables** for Production and Preview. They are injected at build time (`VITE_*` only).

| Variable | Required | Source |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Yes | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase → API → anon / publishable key |
| `VITE_SENTRY_DSN` | No | Sentry project DSN |

**Do not** add these to Cloudflare Pages:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_ACCESS_TOKEN`

Those belong in local `.env.local` or trusted CI for scripts and Edge Function deploys only.

## SPA routing

`public/_redirects` sends all paths to `index.html` so React Router routes (`/login`, `/app/calendar`, `/admin`, `/accept-invite`) work on refresh and direct links.

## Supabase Auth URLs

After the first deploy, note your Cloudflare URL (e.g. `https://mnemonotes.pages.dev`).

In **Supabase → Authentication → URL configuration**:

1. Set **Site URL** to your Cloudflare URL (or custom domain).
2. Add **Redirect URLs**, for example:
   - `https://mnemonotes.pages.dev/**`
   - `https://your-custom-domain.com/**`

## What stays on Supabase

- Postgres, RLS, Realtime
- Edge Functions (`pnpm functions:deploy`)
- Platform admin bootstrap (`pnpm admin:create` from a trusted environment)

## Deploy checklist

1. Connect the GitHub repo in Cloudflare Pages and save build settings above.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy and confirm the site loads.
4. Update Supabase Auth redirect URLs with your Cloudflare domain.
5. Ensure Edge Functions are deployed to the same Supabase project.
6. Create the platform admin account if not already done (`pnpm admin:create`).
