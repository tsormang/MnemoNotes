# Desktop + Mobile setup (shared Supabase data)

MnemoNotes uses **one Supabase project** for desktop browser and Android APK. Firebase is **push-only** — it does not store your app data.

```
Desktop browser ──┐
                  ├──► Supabase (Postgres + Auth + Edge Functions)
Android APK ──────┘         ▲
                            │ FCM token stored here
Firebase (FCM only) ────────┘ delivers push pings when app is closed
```

---

## Step 1 — Confirm one Supabase project (desktop + mobile)

Both clients read the same env vars (baked into the APK at build time):

| Variable | Desktop | Android APK |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | `.env.local` | `.env.production.local` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | `.env.production.local` |

**Do this:**

1. Copy [`.env.example`](../.env.example) → `.env.local` if you have not already.
2. Fill from **Supabase Dashboard → Project Settings → API**:
   - Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - anon / publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (never put in `VITE_*`)
3. Copy [`.env.production.local.example`](../.env.production.local.example) → `.env.production.local` with the **same** `VITE_*` values.

**Verify:**

```bash
node scripts/check-push-setup.mjs
```

---

## Step 2 — Apply database migrations (includes mobile push tables)

Your hosted project needs the latest schema (`device_subscriptions`, `push_sent_at`, etc.).

**Option A — Script (recommended if `SUPABASE_DB_PASSWORD` is in `.env.local`):**

```bash
pnpm setup:push-db
```

**Option B — Full hosted setup:**

```bash
pnpm setup:hosted
```

**Option C — Manual SQL:** run [`supabase/hosted-bootstrap.sql`](../supabase/hosted-bootstrap.sql) once in **Supabase Dashboard → SQL Editor** (only if the project is empty or you know bootstrap is safe).

**Verify:** `node scripts/check-push-setup.mjs` should show `device_subscriptions` table exists.

---

## Step 3 — Deploy Edge Functions

Functions involved in notifications:

| Function | Purpose |
|----------|---------|
| `schedule-notifications` | Create/deliver notification jobs |
| `dispatch-push-notifications` | Send FCM when jobs are due |
| `register-device` | Store Android FCM tokens in Supabase |
| `process-notifications` | Cron entry: schedule + dispatch |

```bash
pnpm functions:deploy
```

Requires in `.env.local`:

- `VITE_SUPABASE_URL` (project ref)
- `SUPABASE_ACCESS_TOKEN` (Dashboard → Account → Access Tokens) for non-interactive deploy

---

## Step 4 — Set Supabase Edge Function secrets

**Dashboard → Project Settings → Edge Functions → Secrets**

| Secret | How to get it |
|--------|---------------|
| `CRON_SECRET` | Generate: `openssl rand -hex 32` or any long random string |
| `FCM_SERVICE_ACCOUNT` | Firebase → Project settings → Service accounts → Generate new private key → paste **entire JSON as one line** |

Also ensure default secrets exist (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — usually auto-injected on hosted projects).

Add to `.env.local` for your reference (optional):

```
CRON_SECRET=your-secret
```

---

## Step 5 — Firebase (push only, not your database)

Firebase does **not** replace Supabase. You only register the Android app so Google can deliver push notifications.

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Create project** (or use existing).
2. **Add app → Android**
   - Package name: `com.mnemonotes.app` (must match Capacitor `appId`)
   - App nickname: `MnemoNotes`
   - Skip SHA-1 for debug APK sideload (add later for Play Store).
3. Download **`google-services.json`**.
4. Place it at:

   ```
   android/app/google-services.json
   ```

   **Important:** the file must be in `android/app/`, not `android/`. Gradle only picks it up from the app module folder.

5. Enable **Cloud Messaging** (usually on by default).
6. **Project settings → Service accounts → Generate new private key** → use JSON for `FCM_SERVICE_ACCOUNT` secret in Step 4.

**No Firestore, no Firebase Auth, no Realtime Database** are needed.

---

## Step 6 — Schedule background notification cron

**Supabase Dashboard → Edge Functions → Cron** (or Integrations → Cron)

| Field | Value |
|-------|-------|
| Function | `process-notifications` |
| Schedule | `*/2 * * * *` (every 2 minutes) |
| HTTP headers | `Authorization: Bearer <your CRON_SECRET>` |

This runs scheduling + FCM dispatch even when no browser/APK is open.

---

## Step 7 — Build the Android APK (same data as desktop)

### Prerequisites

- **JDK 21+:** `winget install Microsoft.OpenJDK.21`
- Android Studio (optional, for emulator) + SDK Platform 34+
- `.env.production.local` with same Supabase URL/key as desktop

### Automated build (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-android-build.ps1
```

Output: `android/app/build/outputs/apk/debug/mnemonotes-app.apk`

### Manual build

```bash
pnpm build:android
pnpm android:apk:debug
```

---

## Step 8 — Install and test shared data

1. Install APK on Android device (enable “Install unknown apps” for sideload).
2. Open app → **sign in with the same account** you use on desktop.
3. Confirm calendar, personnel, and shifts match desktop.
4. Open **Notifications** panel → **Enable mobile alerts** (grants push permission + registers FCM token in Supabase `device_subscriptions`).
5. Create or wait for a due shift reminder → notification should appear when app is backgrounded.

### Quick Supabase checks

**Table Editor → `device_subscriptions`** — row appears after enabling mobile alerts on device.

**Table Editor → `notification_jobs`** — jobs move `queued` → `delivered` → `sent` when cron runs.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mobile shows empty / demo data | Rebuild APK with correct `.env.production.local` |
| Desktop and mobile data differ | Different Supabase URLs or different user accounts |
| No push when app closed | Missing `google-services.json`, `FCM_SERVICE_ACCOUNT`, or cron |
| Cron returns Invalid JWT | Redeploy functions (`pnpm functions:deploy`); `process-notifications` must use `--no-verify-jwt` |
| Phone signed in as different user than desktop | Push tokens and jobs are per-user; use the same account on both |
| Jobs stuck in `queued` past due time | Cron not running — run `node scripts/diagnose-notifications.mjs` |
| Gradle “requires Java 17” or “invalid source release: 21” | Install JDK 21: `winget install Microsoft.OpenJDK.21`, set `JAVA_HOME` |
| `device_subscriptions` missing | Run Step 2 migrations |
| Push works but no in-app toast | Expected when push marks job `sent` before app opens |
| In-app works but no system notification | Rebuild APK after fixes; confirm Supabase cron runs every 2 min |
| Verify Firebase end-to-end | `node scripts/test-fcm-push.mjs user@example.com` (phone backgrounded) |

---

## Checklist summary

- [ ] `.env.local` — Supabase URL + keys
- [ ] `.env.production.local` — **same** `VITE_*` as desktop
- [ ] Migrations applied (`device_subscriptions` exists)
- [ ] Edge Functions deployed
- [ ] `CRON_SECRET` + `FCM_SERVICE_ACCOUNT` secrets set
- [ ] Cron on `process-notifications`
- [ ] `android/app/google-services.json` from Firebase
- [ ] APK built with JDK 17
- [ ] Same user signed in on desktop + mobile
- [ ] Mobile alerts enabled in Notifications panel
