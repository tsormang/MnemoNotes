---
name: wire-live-data
description: Replaces MnemoNotes demo calendar/people data with Supabase + TanStack Query, respecting RLS and domain types. Use when wiring live fetches, mutations, realtime subscriptions, removing demo.ts usage, or connecting PharmacyCalendar to Postgres.
---

# Wire Live Data

## Current state

- Demo source: `src/data/demo.ts`
- Consumers: calendar, people, notifications (and similar)
- Query client already in `src/app/providers.tsx`
- Supabase client: `src/lib/supabase.ts`

## Workflow

```
Progress:
- [ ] 1. Confirm schema + types
- [ ] 2. Add query modules
- [ ] 3. Swap calendar/people off demo
- [ ] 4. Mutations + invalidation
- [ ] 5. Optional Realtime
- [ ] 6. Keep demo fallback if unconfigured
```

### 1. Schema + types

```bash
pnpm supabase:types
```

Use `src/lib/database.types.ts` at the data layer; map to `src/types/domain.ts` for UI if needed.

### 2. Query modules

- Colocate under `src/features/<area>/` or `src/lib/queries/`
- Keys: stable arrays, e.g. `['calendar-items', orgId]`
- Respect `isSupabaseConfigured` — if false, keep demo data so UI still runs

### 3. Swap consumers

- `PharmacyCalendar`: load shifts/notes/tasks from `calendar_items` (+ assignments)
- Filter by org/location; map `kind` to existing `.event-shift|note|task` classes
- People modal: `personnel` / members via RLS-safe selects

### 4. Mutations

- Insert/update/delete through Supabase client when RLS allows
- Privileged flows (invite, hard delete) → Edge Function skill
- `queryClient.invalidateQueries` after success

### 5. Realtime (optional)

- Subscribe to `calendar_items` changes for the active org
- Cleanup subscription on unmount

### 6. Fallback

```ts
if (!isSupabaseConfigured || !supabase) {
  // use demo data
}
```

## Don't

- Bypass RLS with service role in the browser
- Fetch all tenants’ data and filter only on the client
- Replace TanStack Query with ad-hoc fetch soup or Redux
