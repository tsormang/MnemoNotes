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
- Owner: registers and manages a pharmacy workspace.
- Manager: delegated scheduling and personnel management.
- Personnel: invited staff user with assignment and note acknowledgement access.
- Viewer: read-only operational visibility.

Initial workflows:

- Pharmacy owner registration
- Personnel invitation
- Weekly/monthly/yearly calendar views
- Shift and note planning
- Personnel assignment
- Before/during/after notification rules
- Audit-ready role and permission model

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

## Important Paths

- `src/App.tsx`: routes and app shell
- `src/features/calendar/PharmacyCalendar.tsx`: initial pharmacy calendar surface
- `src/features/auth/AuthScreens.tsx`: login, owner registration, invite acceptance placeholders
- `src/lib/access-control.ts`: frontend role and permission map
- `supabase/migrations/20260827100000_initial_pharmacy_security.sql`: initial schema and RLS policies
- `supabase/seed.sql`: default permission seed data

## Development Notes

The current app uses demo data so the product shape is visible before Supabase credentials are configured. Live auth and persistence should be wired through Edge Functions for owner registration and personnel invitation, because those flows need trusted server-side access.
