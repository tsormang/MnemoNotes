# MnemoNotes

Pharmacy-first scheduling and operations notes for shifts, personnel, reminders, and acknowledgements. The product starts with pharmacy workflows and keeps the core scheduling model generic enough to expand into other shift-based businesses later.

## Stack

- Vite + React + TypeScript
- Supabase Auth, Postgres, RLS, Realtime, Edge Functions, Cron, and Queues
- FullCalendar for week, month, year, and list calendar views
- TanStack Query for server state
- React Router for app/auth routes
- React Hook Form + Zod for validated forms
- Vitest + Testing Library for tests

## Product Focus

Initial vertical: pharmacies.

Core roles:

- Developer Admin: platform/operator role, manually seeded, MFA required in production.
- Owner: company-level operational authority for a provisioned workspace.
- Company roles: custom per-organization roles (for example Manager, Pharmacist, Viewer) with configurable permission sets.

Initial workflows:

- Platform admin provisions a company and assigns its owner account
- Owner invites personnel through trusted Edge Functions
- Personnel accept invites and inherit permissions from their company role
- Weekly/monthly calendar views with create/edit, drag-and-drop, resize, search filters, and shift conflict warnings
- Shift and note planning
- Personnel assignment
- Before/during/after notification rules
- Audit-ready role and permission model
- Platform Admin list views for users, personnel, shifts, notes, pharmacies, and audit history
- Active/inactive user operations and hard-delete actions through a service-role Edge Function

## Getting Started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and fill the Supabase values when you connect a local or hosted project.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:types
```

## Platform Admin Setup

Create the Developer Admin account through a trusted local shell or deployment secret store. Do not commit real passwords.

PowerShell example:

```powershell
$env:SUPABASE_URL="http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
$env:ADMIN_EMAIL="<developer-admin-email>"
$env:ADMIN_PASSWORD="<developer-admin-password>"
pnpm admin:create
```

The script creates or updates the Supabase Auth user, writes the profile row, and inserts the user into `platform_admins`.

Sign in as Developer Admin, open `/admin`, and use **Pharmacies → Create company** to provision a tenant and owner account. There is no public owner self-registration route.

Trusted Edge Functions for Phase 1:

```bash
supabase functions serve admin-provision-company invite-personnel accept-invite admin-records
```

## Important Paths

- `src/App.tsx`: routes, guards, and app shell
- `src/features/calendar/PharmacyCalendar.tsx`: live read-only calendar surface
- `src/features/auth/AuthProvider.tsx` and `WorkspaceProvider.tsx`: session and permission context
- `src/features/auth/AuthScreens.tsx`: login and invite acceptance
- `src/features/admin/AdminConsole.tsx`: Developer Admin provisioning and list views
- `src/lib/access-control.ts`: static owner/platform permission bundles
- `src/lib/queries/workspace.ts`: TanStack Query hooks for org, personnel, and calendar data
- `supabase/migrations/20260827130000_company_roles.sql`: custom company roles and invite tokens
- `supabase/functions/admin-provision-company/index.ts`: platform admin company provisioning
- `supabase/functions/invite-personnel/index.ts` and `accept-invite/index.ts`: personnel invite flow
- `supabase/functions/admin-records/index.ts`: service-role platform-admin actions
- `scripts/create-platform-admin.mjs`: secure local setup for the Developer Admin account

## Development Notes

When Supabase is not configured, the app falls back to demo data so the product shape remains visible. With Supabase configured, `/app` requires authentication and calendar/personnel data loads through RLS-safe queries.
