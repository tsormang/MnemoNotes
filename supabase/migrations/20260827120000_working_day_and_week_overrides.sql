-- Working day window on organizations + per-week night-shift overrides.

alter table public.organizations
  add column if not exists working_day_start time not null default '07:00',
  add column if not exists working_day_end time not null default '21:00';

alter table public.organizations
  drop constraint if exists organizations_working_day_range_check;

alter table public.organizations
  add constraint organizations_working_day_range_check
  check (working_day_start < working_day_end);

comment on column public.organizations.working_day_start is
  'Default calendar slot start (24-hour local time for the organization timezone).';
comment on column public.organizations.working_day_end is
  'Default calendar slot end (exclusive upper bound in FullCalendar slotMaxTime terms).';

create table if not exists public.calendar_week_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  week_start_date date not null,
  show_all_hours boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, week_start_date),
  constraint calendar_week_overrides_monday_check
    check (extract(isodow from week_start_date) = 1)
);

comment on table public.calendar_week_overrides is
  'Per-week calendar display overrides (e.g. night-shift weeks showing 00:00–24:00).';

create index if not exists calendar_week_overrides_org_week_idx
  on public.calendar_week_overrides (organization_id, week_start_date);

alter table public.calendar_week_overrides enable row level security;

create policy "Members can read calendar week overrides"
  on public.calendar_week_overrides for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_permission(organization_id, 'organization.read')
  );

create policy "Owners can manage calendar week overrides"
  on public.calendar_week_overrides for all
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_permission(organization_id, 'organization.update')
  )
  with check (
    public.is_platform_admin()
    or public.has_permission(organization_id, 'organization.update')
  );
