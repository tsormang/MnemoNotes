---
name: wire-supabase-auth
description: Wires MnemoNotes Supabase Auth — login, session persistence, route guards, owner registration and invite acceptance via Edge Functions. Use when implementing auth, sign-in, sessions, protected routes, register-owner, accept-invite, or replacing AuthScreens placeholders.
---

# Wire Supabase Auth

## Preconditions

- `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Client: `src/lib/supabase.ts` (`supabase` may be `null` if unconfigured)
- Placeholders: `src/features/auth/AuthScreens.tsx`

## Workflow

```
Progress:
- [ ] 1. Session provider
- [ ] 2. Login / logout
- [ ] 3. Route guards
- [ ] 4. Owner registration (Edge Function)
- [ ] 5. Invite acceptance (Edge Function)
- [ ] 6. Smoke test locally
```

### 1. Session provider

- Add auth context/hook under `src/features/auth/` (or `src/app/`) using `supabase.auth.getSession()` + `onAuthStateChange`
- Keep it behind `isSupabaseConfigured`; show existing `SupabaseNotice` when not configured
- Do not store service-role keys in the client

### 2. Login / logout

- Wire `LoginScreen` with RHF + Zod (email/password) → `supabase.auth.signInWithPassword`
- On success navigate to `/app/calendar`
- Expose sign-out from the app bar (modal or icon), calling `supabase.auth.signOut`

### 3. Route guards

- Protect `/app/*` (and `/admin` for platform admins) with session checks
- Unauthenticated → `/login`
- Keep public: `/login`, `/register-owner`, `/accept-invite`

### 4. Owner registration

- **Do not** create org + owner membership only from the browser with anon key if that bypasses trust boundaries
- Call an Edge Function that: creates auth user, profile, organization, owner membership (service role after validation)
- Client submits validated `ownerRegistrationSchema` from `src/lib/validation.ts`

### 5. Invite acceptance

- Invite flow: Edge Function creates invite / auth user; accept screen sets password and activates membership
- Align with `organization_members.status` (`invited` → `active`)

### 6. Smoke test

```bash
pnpm supabase:start
pnpm admin:create   # if testing platform admin
pnpm dev
```

Verify login, logout, and guarded redirects.

## Security

- Publishable/anon key only in Vite
- MFA for `developer_admin` is a production requirement — do not weaken that path
- Match roles/permissions in `src/lib/access-control.ts` with RLS
