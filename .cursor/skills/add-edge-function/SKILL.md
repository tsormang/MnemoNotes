---
name: add-edge-function
description: Creates or extends Supabase Edge Functions for trusted MnemoNotes server work (owner registration, invites, platform admin). Use when adding Deno functions, service-role operations, admin-records, CORS handlers, or anything that must not run with only the anon key in the browser.
---

# Add Edge Function

## When to use an Edge Function

- Creating users/orgs with elevated privileges
- Hard deletes, auth user status, platform-admin actions
- Invite issuance / acceptance that needs service role
- Any secret or bypass of RLS that must stay server-side

## Reference

Copy structure and auth checks from `supabase/functions/admin-records/index.ts`:

1. Handle `OPTIONS` + CORS headers
2. Require `Authorization: Bearer <jwt>`
3. User client (anon + JWT) for `auth.getUser()`
4. Authorize (e.g. `platform_admins` or org role)
5. Only then use service-role client
6. Return JSON with explicit status codes

## Workflow

```
Progress:
- [ ] 1. Create function folder
- [ ] 2. Implement authz + action
- [ ] 3. Client caller
- [ ] 4. Local serve + test
```

### 1. Create function

- Path: `supabase/functions/<name>/index.ts`
- Deno + `https://esm.sh/@supabase/supabase-js@2`
- Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 2. Implement

- Validate body (action, ids, reason)
- Fail closed: 401 missing/invalid JWT, 403 unauthorized, 400 bad input
- Prefer narrow allowlists (see `hardDeleteTables` in admin-records)
- Log audit-worthy actions when an audit table/path exists

### 3. Client caller

- Call via `supabase.functions.invoke('<name>', { body })` only when `supabase` is configured
- Never embed service-role key in Vite env

### 4. Local test

```bash
supabase functions serve <name>
```

Exercise from the app or a minimal curl with a user JWT.

## Don't

- Put service-role usage in React
- Skip platform-admin / membership checks before privileged writes
- Open CORS more than needed for the app origin in production hardening later
