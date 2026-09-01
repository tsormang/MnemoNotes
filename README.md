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

**Desktop + Android sharing the same data:** see [`docs/desktop-mobile-android-setup.md`](docs/desktop-mobile-android-setup.md).

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

Trusted Edge Functions:

```bash
supabase functions serve admin-provision-company invite-personnel accept-invite admin-records schedule-notifications dispatch-push-notifications register-device process-notifications
```

Optional production monitoring: set `VITE_SENTRY_DSN` in `.env.local` to enable Sentry error capture (wired through `src/lib/logger.ts`).

## Android APK (Capacitor)

MnemoNotes ships as a standard Vite SPA wrapped with Capacitor for installable Android builds.

### Prerequisites

- Android Studio + Android SDK Platform 34+
- **JDK 21+** (Capacitor 8 / Android Gradle Plugin 8.x; set `JAVA_HOME` before running Gradle)
- Firebase project with Cloud Messaging enabled (for push)
- `google-services.json` placed in `android/app/` (not committed — see `.gitignore`)

### Build a debug APK

```bash
pnpm install
pnpm build:android
pnpm android:apk:debug
```

Output: `android/app/build/outputs/apk/debug/mnemonotes-app.apk`

Open the native project in Android Studio:

```bash
pnpm android:open
```

### Production env in the APK

`VITE_*` values are baked in at `pnpm build` time. Use `.env.production.local` (or CI secrets) with your hosted Supabase URL and anon key before `pnpm build:android`.

### Push notifications (hosted Supabase)

1. Set Edge Function secrets: `CRON_SECRET`, `FCM_SERVICE_ACCOUNT` (Firebase service account JSON string)
2. Deploy functions: `pnpm functions:deploy`
3. Schedule `process-notifications` every 2 minutes in Supabase Dashboard → Edge Functions → Cron (Authorization: `Bearer <CRON_SECRET>`)
4. Install the APK, sign in, open Notifications → **Enable mobile alerts**

### Release builds

| Stage | Command | Output |
|-------|---------|--------|
| Internal sideload | `cd android && ./gradlew assembleRelease` | `app-release.apk` |
| Play Store | `cd android && ./gradlew bundleRelease` | `app-release.aab` |

Create an upload keystore locally; never commit keystore files or passwords.

## Important Paths

- `src/App.tsx`: routes, guards, and app shell
- `src/features/calendar/PharmacyCalendar.tsx`: live calendar with create/edit, drag/drop, resize, and print
- `src/features/calendar/NotificationsPanel.tsx`: in-app notifications and acknowledgements
- `src/features/auth/AuthProvider.tsx` and `WorkspaceProvider.tsx`: session and permission context
- `src/features/auth/AuthScreens.tsx`: login and invite acceptance
- `src/features/admin/AdminConsole.tsx`: Developer Admin provisioning and list views
- `src/features/people/CompanyRolesMatrix.tsx`: company role CRUD and permission matrix
- `src/lib/access-control.ts`: static owner/platform permission bundles
- `src/lib/queries/workspace.ts`: TanStack Query hooks for org, personnel, and calendar data
- `src/lib/queries/notifications.ts`: notification jobs and acknowledgement hooks
- `src/lib/logger.ts` and `src/lib/sentry.ts`: developer logging and optional Sentry
- `supabase/migrations/20260827130000_company_roles.sql`: custom company roles and invite tokens
- `supabase/migrations/20260828120000_notifications_acknowledgements.sql`: acknowledgement table and notification rule sync trigger
- `supabase/functions/admin-provision-company/index.ts`: platform admin company provisioning
- `supabase/functions/invite-personnel/index.ts` and `accept-invite/index.ts`: personnel invite flow
- `supabase/functions/schedule-notifications/index.ts`: materialize in-app notification jobs from rules
- `supabase/functions/dispatch-push-notifications/index.ts`: send FCM push for delivered jobs
- `supabase/functions/register-device/index.ts`: register Android FCM tokens per user/device
- `supabase/functions/process-notifications/index.ts`: cron orchestrator (schedule + dispatch)
- `capacitor.config.ts` and `android/`: Capacitor Android shell for APK builds
- `supabase/functions/admin-records/index.ts`: service-role platform-admin actions
- `scripts/create-platform-admin.mjs`: secure local setup for the Developer Admin account

## Development Notes

When Supabase is not configured, the app falls back to demo data so the product shape remains visible. With Supabase configured, `/app` requires authentication and calendar/personnel data loads through RLS-safe queries. Use the calendar ribbon print action for a print-friendly schedule layout.
