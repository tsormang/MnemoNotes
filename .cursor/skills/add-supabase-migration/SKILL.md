---
name: add-supabase-migration
description: Adds additive Supabase SQL migrations with RLS, permission seeds, and regenerated TypeScript types for MnemoNotes. Use when changing schema, tables, enums, policies, role_permissions, seed data, or running supabase db reset / gen types.
---

# Add Supabase Migration

## Workflow

```
Progress:
- [ ] 1. Design change
- [ ] 2. Write migration
- [ ] 3. Seed / permissions if needed
- [ ] 4. Reset local DB
- [ ] 5. Regenerate types
- [ ] 6. Align frontend domain types
```

### 1. Design change

- Prefer additive migrations (new columns/tables/policies). Avoid destructive edits to applied migrations.
- Tenant data must stay scoped by `organization_id` (or equivalent) with RLS.
- New permissions: extend `app_permission` enum + `role_permissions` seed; mirror in `src/lib/access-control.ts`.

### 2. Write migration

- Path: `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql`
- Follow patterns in `20260827100000_initial_pharmacy_security.sql`
- Enable RLS on new tables; policies must check membership/role (and platform admin where appropriate)
- Use existing enums (`app_role`, `calendar_item_kind`, etc.) before inventing new ones

### 3. Seed / permissions

- Default permission rows: `supabase/seed.sql` or a dedicated permission seed migration
- Keep SQL seeds and `rolePermissions` in `src/lib/access-control.ts` in sync

### 4–5. Apply + types

```bash
pnpm supabase:reset
pnpm supabase:types
```

Types output: `src/lib/database.types.ts`

### 6. Frontend alignment

- Update `src/types/domain.ts` only if app-facing unions/labels changed
- Prefer generated DB types at the data layer once wired

## Checklist

- [ ] RLS enabled + policies for select/insert/update/delete as needed
- [ ] No service-role assumptions in client SQL
- [ ] `pnpm supabase:reset` succeeds
- [ ] Types regenerated
- [ ] Frontend permission map updated if permissions changed
