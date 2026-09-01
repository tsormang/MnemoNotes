-- MnemoNotes hosted bootstrap (migrations + seed)
-- Run once in Supabase Dashboard → SQL Editor if `supabase db push` is unavailable.

-- === 20260827100000_initial_pharmacy_security.sql ===
create extension if not exists pgcrypto;

create type public.business_vertical as enum ('pharmacy', 'generic');
create type public.app_role as enum ('developer_admin', 'owner', 'manager', 'personnel', 'viewer');
create type public.member_status as enum ('invited', 'active', 'disabled');
create type public.calendar_item_kind as enum ('shift', 'note', 'task');
create type public.calendar_item_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.notification_channel as enum ('in_app', 'push', 'email', 'sms', 'teams');
create type public.notification_status as enum ('queued', 'sent', 'delivered', 'failed', 'acknowledged', 'expired');
create type public.notification_trigger as enum ('before_start', 'at_start', 'during', 'before_end', 'after_end');
create type public.app_permission as enum (
  'platform.admin',
  'platform.users.read',
  'platform.users.update',
  'platform.users.delete',
  'platform.tenants.read',
  'platform.tenants.update',
  'platform.tenants.delete',
  'platform.records.hard_delete',
  'organization.read',
  'organization.update',
  'users.invite',
  'users.disable',
  'roles.manage',
  'locations.manage',
  'personnel.manage',
  'shifts.read',
  'shifts.create',
  'shifts.update',
  'shifts.delete',
  'shifts.assign',
  'notes.read',
  'notes.create',
  'notes.update',
  'notes.delete',
  'notes.acknowledge',
  'notifications.manage',
  'audit.read'
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  timezone text not null default 'Europe/Athens',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

create table public.role_permissions (
  role public.app_role not null,
  permission public.app_permission not null,
  primary key (role, permission)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vertical public.business_vertical not null default 'pharmacy',
  status text not null default 'active',
  timezone text not null default 'Europe/Athens',
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.app_role not null,
  status public.member_status not null default 'invited',
  invited_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'Europe/Athens',
  operating_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.pharmacy_profiles (
  organization_id uuid primary key references public.organizations on delete cascade,
  license_reference text,
  default_note_categories text[] not null default array[
    'Stock',
    'Prescription follow-up',
    'Customer follow-up',
    'Supplier',
    'Delivery',
    'Compliance',
    'Handover',
    'Internal'
  ],
  metadata jsonb not null default '{}'::jsonb
);

create table public.personnel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  location_id uuid references public.locations on delete set null,
  full_name text not null,
  title text not null default 'Personnel',
  status public.member_status not null default 'active',
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  location_id uuid references public.locations on delete set null,
  kind public.calendar_item_kind not null,
  status public.calendar_item_status not null default 'draft',
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Athens',
  priority text not null default 'normal',
  requires_acknowledgement boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_items_valid_range check (ends_at > starts_at)
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  calendar_item_id uuid not null references public.calendar_items on delete cascade,
  personnel_id uuid not null references public.personnel on delete cascade,
  status text not null default 'assigned',
  assigned_by uuid references auth.users,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (calendar_item_id, personnel_id)
);

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  calendar_item_id uuid not null references public.calendar_items on delete cascade,
  trigger_kind public.notification_trigger not null,
  offset_minutes integer not null default 0,
  channel public.notification_channel not null default 'in_app',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  notification_rule_id uuid references public.notification_rules on delete cascade,
  recipient_user_id uuid references auth.users on delete cascade,
  scheduled_for timestamptz not null,
  status public.notification_status not null default 'queued',
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations on delete cascade,
  actor_user_id uuid references auth.users on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members
      where organization_id = target_organization_id
        and user_id = auth.uid()
        and status = 'active'
        and role = any(allowed_roles)
    );
$$;

create or replace function public.has_permission(
  target_organization_id uuid,
  requested_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and rp.permission = requested_permission
    );
$$;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.pharmacy_profiles enable row level security;
alter table public.personnel enable row level security;
alter table public.calendar_items enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.audit_log enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Platform admins can read platform admin list"
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

create policy "Authenticated users can read role permissions"
  on public.role_permissions for select
  to authenticated
  using (true);

create policy "Members can read their organizations"
  on public.organizations for select
  to authenticated
  using (public.has_permission(id, 'organization.read'));

create policy "Owners can update organizations"
  on public.organizations for update
  to authenticated
  using (public.has_permission(id, 'organization.update'))
  with check (public.has_permission(id, 'organization.update'));

create policy "Members can read organization members"
  on public.organization_members for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Owners can manage organization members"
  on public.organization_members for all
  to authenticated
  using (public.has_permission(organization_id, 'roles.manage'))
  with check (public.has_permission(organization_id, 'roles.manage'));

create policy "Members can read locations"
  on public.locations for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Owners can manage locations"
  on public.locations for all
  to authenticated
  using (public.has_permission(organization_id, 'locations.manage'))
  with check (public.has_permission(organization_id, 'locations.manage'));

create policy "Members can read pharmacy profiles"
  on public.pharmacy_profiles for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Owners can update pharmacy profiles"
  on public.pharmacy_profiles for update
  to authenticated
  using (public.has_permission(organization_id, 'organization.update'))
  with check (public.has_permission(organization_id, 'organization.update'));

create policy "Members can read personnel"
  on public.personnel for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Managers can manage personnel"
  on public.personnel for all
  to authenticated
  using (public.has_permission(organization_id, 'personnel.manage'))
  with check (public.has_permission(organization_id, 'personnel.manage'));

create policy "Members can read calendar items"
  on public.calendar_items for select
  to authenticated
  using (public.has_permission(organization_id, 'shifts.read') or public.has_permission(organization_id, 'notes.read'));

create policy "Schedulers can create calendar items"
  on public.calendar_items for insert
  to authenticated
  with check (
    public.has_permission(organization_id, 'shifts.create')
    or public.has_permission(organization_id, 'notes.create')
  );

create policy "Schedulers can update calendar items"
  on public.calendar_items for update
  to authenticated
  using (
    public.has_permission(organization_id, 'shifts.update')
    or public.has_permission(organization_id, 'notes.update')
  )
  with check (
    public.has_permission(organization_id, 'shifts.update')
    or public.has_permission(organization_id, 'notes.update')
  );

create policy "Schedulers can delete calendar items"
  on public.calendar_items for delete
  to authenticated
  using (
    public.has_permission(organization_id, 'shifts.delete')
    or public.has_permission(organization_id, 'notes.delete')
  );

create policy "Members can read shift assignments"
  on public.shift_assignments for select
  to authenticated
  using (public.has_permission(organization_id, 'shifts.read'));

create policy "Schedulers can manage shift assignments"
  on public.shift_assignments for all
  to authenticated
  using (public.has_permission(organization_id, 'shifts.assign'))
  with check (public.has_permission(organization_id, 'shifts.assign'));

create policy "Members can read notification rules"
  on public.notification_rules for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Managers can manage notification rules"
  on public.notification_rules for all
  to authenticated
  using (public.has_permission(organization_id, 'notifications.manage'))
  with check (public.has_permission(organization_id, 'notifications.manage'));

create policy "Users can read their notification jobs"
  on public.notification_jobs for select
  to authenticated
  using (recipient_user_id = auth.uid() or public.has_permission(organization_id, 'notifications.manage'));

create policy "Managers can manage notification jobs"
  on public.notification_jobs for all
  to authenticated
  using (public.has_permission(organization_id, 'notifications.manage'))
  with check (public.has_permission(organization_id, 'notifications.manage'));

create policy "Owners can read audit log"
  on public.audit_log for select
  to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'audit.read'));

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_org_idx on public.organization_members (organization_id);
create index locations_org_idx on public.locations (organization_id);
create index personnel_org_idx on public.personnel (organization_id);
create index calendar_items_org_starts_idx on public.calendar_items (organization_id, starts_at);
create index shift_assignments_item_idx on public.shift_assignments (calendar_item_id);
create index notification_jobs_due_idx on public.notification_jobs (status, scheduled_for);
create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);


-- === 20260827110000_platform_admin_absolute_control.sql ===
alter type public.app_permission add value if not exists 'platform.users.read';
alter type public.app_permission add value if not exists 'platform.users.update';
alter type public.app_permission add value if not exists 'platform.users.delete';
alter type public.app_permission add value if not exists 'platform.tenants.read';
alter type public.app_permission add value if not exists 'platform.tenants.update';
alter type public.app_permission add value if not exists 'platform.tenants.delete';
alter type public.app_permission add value if not exists 'platform.records.hard_delete';

create table if not exists public.platform_admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_admin_actions enable row level security;

create policy "Platform admins can read platform actions"
  on public.platform_admin_actions for select
  to authenticated
  using (public.is_platform_admin());


-- === 20260827110010_platform_admin_permission_seed.sql ===
insert into public.role_permissions (role, permission)
values
  ('developer_admin', 'platform.users.read'),
  ('developer_admin', 'platform.users.update'),
  ('developer_admin', 'platform.users.delete'),
  ('developer_admin', 'platform.tenants.read'),
  ('developer_admin', 'platform.tenants.update'),
  ('developer_admin', 'platform.tenants.delete'),
  ('developer_admin', 'platform.records.hard_delete'),
  ('developer_admin', 'organization.update'),
  ('developer_admin', 'users.invite'),
  ('developer_admin', 'users.disable'),
  ('developer_admin', 'roles.manage'),
  ('developer_admin', 'locations.manage'),
  ('developer_admin', 'personnel.manage'),
  ('developer_admin', 'shifts.read'),
  ('developer_admin', 'shifts.create'),
  ('developer_admin', 'shifts.update'),
  ('developer_admin', 'shifts.delete'),
  ('developer_admin', 'shifts.assign'),
  ('developer_admin', 'notes.read'),
  ('developer_admin', 'notes.create'),
  ('developer_admin', 'notes.update'),
  ('developer_admin', 'notes.delete'),
  ('developer_admin', 'notes.acknowledge'),
  ('developer_admin', 'notifications.manage')
on conflict do nothing;


-- === 20260827120000_working_day_and_week_overrides.sql ===
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


-- === 20260827130000_company_roles.sql ===
-- Custom company roles with per-role permissions and invite tokens.

create table public.company_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  description text not null default '',
  icon text not null default 'user',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.company_role_permissions (
  company_role_id uuid not null references public.company_roles on delete cascade,
  permission public.app_permission not null,
  primary key (company_role_id, permission)
);

alter table public.personnel
  add column company_role_id uuid references public.company_roles on delete restrict;

create table public.personnel_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  personnel_id uuid not null references public.personnel on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index company_roles_org_idx on public.company_roles (organization_id);
create index company_role_permissions_role_idx on public.company_role_permissions (company_role_id);
create index personnel_company_role_idx on public.personnel (company_role_id);
create index personnel_invites_personnel_idx on public.personnel_invites (personnel_id);
create index personnel_invites_org_idx on public.personnel_invites (organization_id);

alter table public.company_roles enable row level security;
alter table public.company_role_permissions enable row level security;
alter table public.personnel_invites enable row level security;

-- Updated permission resolution: platform admin, owner bundle, or company role permissions.
create or replace function public.has_permission(
  target_organization_id uuid,
  requested_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = 'owner'
        and rp.permission = requested_permission
    )
    or exists (
      select 1
      from public.organization_members om
      join public.personnel p on p.profile_id = auth.uid()
        and p.organization_id = om.organization_id
      join public.company_role_permissions crp on crp.company_role_id = p.company_role_id
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and crp.permission = requested_permission
    );
$$;

create policy "Members can read company roles"
  on public.company_roles for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Role managers can manage company roles"
  on public.company_roles for all
  to authenticated
  using (public.has_permission(organization_id, 'roles.manage'))
  with check (public.has_permission(organization_id, 'roles.manage'));

create policy "Members can read company role permissions"
  on public.company_role_permissions for select
  to authenticated
  using (
    exists (
      select 1
      from public.company_roles cr
      where cr.id = company_role_id
        and public.has_permission(cr.organization_id, 'organization.read')
    )
  );

create policy "Role managers can manage company role permissions"
  on public.company_role_permissions for all
  to authenticated
  using (
    exists (
      select 1
      from public.company_roles cr
      where cr.id = company_role_id
        and public.has_permission(cr.organization_id, 'roles.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.company_roles cr
      where cr.id = company_role_id
        and public.has_permission(cr.organization_id, 'roles.manage')
    )
  );

-- Platform admins can read audit log across all orgs.
create policy "Platform admins can read all audit log"
  on public.audit_log for select
  to authenticated
  using (public.is_platform_admin());

-- Platform admins can read all organizations.
create policy "Platform admins can read all organizations"
  on public.organizations for select
  to authenticated
  using (public.is_platform_admin());

-- Platform admins can read all organization members.
create policy "Platform admins can read all organization members"
  on public.organization_members for select
  to authenticated
  using (public.is_platform_admin());

-- Platform admins can read all personnel.
create policy "Platform admins can read all personnel"
  on public.personnel for select
  to authenticated
  using (public.is_platform_admin());

-- Platform admins can read all calendar items.
create policy "Platform admins can read all calendar items"
  on public.calendar_items for select
  to authenticated
  using (public.is_platform_admin());

-- Platform admins can read all shift assignments.
create policy "Platform admins can read all shift assignments"
  on public.shift_assignments for select
  to authenticated
  using (public.is_platform_admin());


-- === 20260828100000_organization_owner_invites.sql ===
-- Pending owner registration invites issued by platform admins.

create table public.organization_owner_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  email text not null,
  full_name text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index organization_owner_invites_org_idx on public.organization_owner_invites (organization_id);
create unique index organization_owner_invites_pending_org_idx
  on public.organization_owner_invites (organization_id)
  where accepted_at is null;

alter table public.organization_owner_invites enable row level security;

create policy "Platform admins can read owner invites"
  on public.organization_owner_invites for select
  to authenticated
  using (public.is_platform_admin());


-- === 20260828120000_notifications_acknowledgements.sql ===
-- Phase 3: acknowledgements, notification rule sync, recipient job updates

create table public.calendar_item_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  calendar_item_id uuid not null references public.calendar_items on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (calendar_item_id, user_id)
);

alter table public.calendar_item_acknowledgements enable row level security;

create policy "Members can read acknowledgements"
  on public.calendar_item_acknowledgements for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Users can acknowledge items in their org"
  on public.calendar_item_acknowledgements for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_permission(organization_id, 'notes.acknowledge')
  );

create index calendar_item_ack_item_idx
  on public.calendar_item_acknowledgements (calendar_item_id);

create index calendar_item_ack_user_idx
  on public.calendar_item_acknowledgements (user_id, organization_id);

-- Recipients may mark their own in-app jobs as acknowledged
create policy "Recipients can acknowledge notification jobs"
  on public.notification_jobs for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create or replace function public.sync_calendar_notification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offsets jsonb;
  offset_val integer;
begin
  delete from public.notification_rules where calendar_item_id = new.id;

  offsets := new.metadata -> 'notificationOffsets';
  if offsets is null or jsonb_typeof(offsets) <> 'array' then
    return new;
  end if;

  for offset_val in
    select value::integer
    from jsonb_array_elements_text(offsets) as value
  loop
    insert into public.notification_rules (
      organization_id,
      calendar_item_id,
      trigger_kind,
      offset_minutes,
      channel,
      enabled
    )
    values (
      new.organization_id,
      new.id,
      case
        when offset_val < 0 then 'before_start'::public.notification_trigger
        when offset_val = 0 then 'at_start'::public.notification_trigger
        else 'during'::public.notification_trigger
      end,
      abs(offset_val),
      'in_app',
      true
    );
  end loop;

  return new;
end;
$$;

create trigger calendar_items_sync_notification_rules
  after insert or update of metadata, starts_at, ends_at
  on public.calendar_items
  for each row
  execute function public.sync_calendar_notification_rules();


-- === 20260828121000_personnel_invites_read.sql ===
-- Allow personnel managers to read pending invites for their organization.

create policy "Personnel managers can read personnel invites"
  on public.personnel_invites for select
  to authenticated
  using (public.has_permission(organization_id, 'personnel.manage'));


-- === 20260828135000_stats_permission.sql ===
-- Phase 4: owner/manager workforce statistics (enum value must commit before use)
alter type public.app_permission add value if not exists 'stats.read';


-- === 20260828140000_org_notification_defaults.sql ===
-- Organization-level notification defaults (reminder offset presets).

alter table public.organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.settings is
  'Org-wide settings JSON. notificationDefaults: { shift, ackRequired, note, task } minute offsets.';


-- === 20260828140001_stats_permission_seed.sql ===
-- Phase 4: seed stats.read for roles that can view workforce analytics
insert into public.role_permissions (role, permission)
values
  ('developer_admin', 'stats.read'),
  ('owner', 'stats.read'),
  ('manager', 'stats.read')
on conflict do nothing;


-- === 20260828150000_app_icons.sql ===
-- Global icon catalog (app static assets) + entity icon_id references.

create type public.icon_entity_type as enum (
  'organization',
  'personnel',
  'company_role',
  'note',
  'task'
);

create table public.app_icons (
  id text primary key,
  label text not null,
  path text not null,
  entity_types public.icon_entity_type[] not null,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.app_icons enable row level security;

create policy "Authenticated users can read app icons"
  on public.app_icons for select
  to authenticated
  using (true);

insert into public.app_icons (id, label, path, entity_types, tags, sort_order) values
  ('org-default', 'Default company', '/icons/entities/org-default.svg', array['organization']::public.icon_entity_type[], '{}', 0),
  ('org-pharmacy', 'Pharmacy', '/icons/entities/org-pharmacy.svg', array['organization']::public.icon_entity_type[], '{pharmacy}', 1),
  ('org-clinic', 'Clinic', '/icons/entities/org-clinic.svg', array['organization']::public.icon_entity_type[], '{clinic}', 2),
  ('org-store', 'Store', '/icons/entities/org-store.svg', array['organization']::public.icon_entity_type[], '{store}', 3),
  ('person-default', 'Default person', '/icons/entities/person-default.svg', array['personnel']::public.icon_entity_type[], '{}', 10),
  ('person-01', 'Person 1', '/icons/entities/person-01.svg', array['personnel']::public.icon_entity_type[], '{}', 11),
  ('person-02', 'Person 2', '/icons/entities/person-02.svg', array['personnel']::public.icon_entity_type[], '{}', 12),
  ('person-03', 'Person 3', '/icons/entities/person-03.svg', array['personnel']::public.icon_entity_type[], '{}', 13),
  ('person-04', 'Person 4', '/icons/entities/person-04.svg', array['personnel']::public.icon_entity_type[], '{}', 14),
  ('person-05', 'Person 5', '/icons/entities/person-05.svg', array['personnel']::public.icon_entity_type[], '{}', 15),
  ('person-06', 'Person 6', '/icons/entities/person-06.svg', array['personnel']::public.icon_entity_type[], '{}', 16),
  ('person-07', 'Person 7', '/icons/entities/person-07.svg', array['personnel']::public.icon_entity_type[], '{}', 17),
  ('person-08', 'Person 8', '/icons/entities/person-08.svg', array['personnel']::public.icon_entity_type[], '{}', 18),
  ('person-09', 'Person 9', '/icons/entities/person-09.svg', array['personnel']::public.icon_entity_type[], '{}', 19),
  ('person-10', 'Person 10', '/icons/entities/person-10.svg', array['personnel']::public.icon_entity_type[], '{}', 20),
  ('person-11', 'Person 11', '/icons/entities/person-11.svg', array['personnel']::public.icon_entity_type[], '{}', 21),
  ('role-user-cog', 'Manager', '/icons/entities/role-user-cog.svg', array['company_role']::public.icon_entity_type[], '{manager}', 30),
  ('role-pill', 'Pharmacist', '/icons/entities/role-pill.svg', array['company_role']::public.icon_entity_type[], '{pharmacy}', 31),
  ('role-eye', 'Viewer', '/icons/entities/role-eye.svg', array['company_role']::public.icon_entity_type[], '{viewer}', 32),
  ('note-default', 'Default note', '/icons/entities/note-default.svg', array['note']::public.icon_entity_type[], '{}', 40),
  ('note-stock', 'Stock', '/icons/entities/note-stock.svg', array['note']::public.icon_entity_type[], '{stock}', 41),
  ('note-handover', 'Handover', '/icons/entities/note-handover.svg', array['note']::public.icon_entity_type[], '{handover}', 42),
  ('note-delivery', 'Delivery', '/icons/entities/note-delivery.svg', array['note']::public.icon_entity_type[], '{delivery}', 43),
  ('note-alert', 'Alert', '/icons/entities/note-alert.svg', array['note']::public.icon_entity_type[], '{alert}', 44),
  ('note-info', 'Info', '/icons/entities/note-info.svg', array['note']::public.icon_entity_type[], '{info}', 45),
  ('task-default', 'Default task', '/icons/entities/task-default.svg', array['task']::public.icon_entity_type[], '{}', 50),
  ('task-checklist', 'Checklist', '/icons/entities/task-checklist.svg', array['task']::public.icon_entity_type[], '{checklist}', 51),
  ('task-phone', 'Phone', '/icons/entities/task-phone.svg', array['task']::public.icon_entity_type[], '{phone}', 52),
  ('task-cleaning', 'Cleaning', '/icons/entities/task-cleaning.svg', array['task']::public.icon_entity_type[], '{cleaning}', 53);

alter table public.organizations
  add column icon_id text not null default 'org-default'
  references public.app_icons (id);

alter table public.personnel
  add column icon_id text not null default 'person-default'
  references public.app_icons (id);

alter table public.company_roles
  add column icon_id text references public.app_icons (id);

update public.company_roles
set icon_id = case icon
  when 'user-cog' then 'role-user-cog'
  when 'pill' then 'role-pill'
  when 'eye' then 'role-eye'
  else 'role-user-cog'
end;

alter table public.company_roles
  alter column icon_id set not null,
  alter column icon_id set default 'role-user-cog';

alter table public.company_roles
  drop column icon;


-- === 20260828160000_personnel_avatars.sql ===
-- Personnel avatars (male/female) + avatar_gender on people entities.

create type public.avatar_gender as enum ('male', 'female');

alter table public.app_icons
  add column avatar_gender public.avatar_gender;

alter table public.personnel
  add column avatar_gender public.avatar_gender not null default 'female';

insert into public.app_icons (id, label, path, entity_types, tags, sort_order, avatar_gender) values
  ('avatar-male-001', 'Male avatar 1', '/avatars/male/avatar_001.png', array['personnel']::public.icon_entity_type[], '{male}', 1001, 'male'),
  ('avatar-male-003', 'Male avatar 3', '/avatars/male/avatar_003.png', array['personnel']::public.icon_entity_type[], '{male}', 1003, 'male'),
  ('avatar-male-006', 'Male avatar 6', '/avatars/male/avatar_006.png', array['personnel']::public.icon_entity_type[], '{male}', 1006, 'male'),
  ('avatar-male-008', 'Male avatar 8', '/avatars/male/avatar_008.png', array['personnel']::public.icon_entity_type[], '{male}', 1008, 'male'),
  ('avatar-male-009', 'Male avatar 9', '/avatars/male/avatar_009.png', array['personnel']::public.icon_entity_type[], '{male}', 1009, 'male'),
  ('avatar-male-011', 'Male avatar 11', '/avatars/male/avatar_011.png', array['personnel']::public.icon_entity_type[], '{male}', 1011, 'male'),
  ('avatar-male-012', 'Male avatar 12', '/avatars/male/avatar_012.png', array['personnel']::public.icon_entity_type[], '{male}', 1012, 'male'),
  ('avatar-male-014', 'Male avatar 14', '/avatars/male/avatar_014.png', array['personnel']::public.icon_entity_type[], '{male}', 1014, 'male'),
  ('avatar-male-016', 'Male avatar 16', '/avatars/male/avatar_016.png', array['personnel']::public.icon_entity_type[], '{male}', 1016, 'male'),
  ('avatar-male-021', 'Male avatar 21', '/avatars/male/avatar_021.png', array['personnel']::public.icon_entity_type[], '{male}', 1021, 'male'),
  ('avatar-male-022', 'Male avatar 22', '/avatars/male/avatar_022.png', array['personnel']::public.icon_entity_type[], '{male}', 1022, 'male'),
  ('avatar-male-023', 'Male avatar 23', '/avatars/male/avatar_023.png', array['personnel']::public.icon_entity_type[], '{male}', 1023, 'male'),
  ('avatar-male-024', 'Male avatar 24', '/avatars/male/avatar_024.png', array['personnel']::public.icon_entity_type[], '{male}', 1024, 'male'),
  ('avatar-male-026', 'Male avatar 26', '/avatars/male/avatar_026.png', array['personnel']::public.icon_entity_type[], '{male}', 1026, 'male'),
  ('avatar-male-029', 'Male avatar 29', '/avatars/male/avatar_029.png', array['personnel']::public.icon_entity_type[], '{male}', 1029, 'male'),
  ('avatar-male-030', 'Male avatar 30', '/avatars/male/avatar_030.png', array['personnel']::public.icon_entity_type[], '{male}', 1030, 'male'),
  ('avatar-male-031', 'Male avatar 31', '/avatars/male/avatar_031.png', array['personnel']::public.icon_entity_type[], '{male}', 1031, 'male'),
  ('avatar-male-032', 'Male avatar 32', '/avatars/male/avatar_032.png', array['personnel']::public.icon_entity_type[], '{male}', 1032, 'male'),
  ('avatar-male-033', 'Male avatar 33', '/avatars/male/avatar_033.png', array['personnel']::public.icon_entity_type[], '{male}', 1033, 'male'),
  ('avatar-male-034', 'Male avatar 34', '/avatars/male/avatar_034.png', array['personnel']::public.icon_entity_type[], '{male}', 1034, 'male'),
  ('avatar-male-035', 'Male avatar 35', '/avatars/male/avatar_035.png', array['personnel']::public.icon_entity_type[], '{male}', 1035, 'male'),
  ('avatar-male-036', 'Male avatar 36', '/avatars/male/avatar_036.png', array['personnel']::public.icon_entity_type[], '{male}', 1036, 'male'),
  ('avatar-male-037', 'Male avatar 37', '/avatars/male/avatar_037.png', array['personnel']::public.icon_entity_type[], '{male}', 1037, 'male'),
  ('avatar-male-038', 'Male avatar 38', '/avatars/male/avatar_038.png', array['personnel']::public.icon_entity_type[], '{male}', 1038, 'male'),
  ('avatar-male-039', 'Male avatar 39', '/avatars/male/avatar_039.png', array['personnel']::public.icon_entity_type[], '{male}', 1039, 'male'),
  ('avatar-male-040', 'Male avatar 40', '/avatars/male/avatar_040.png', array['personnel']::public.icon_entity_type[], '{male}', 1040, 'male'),
  ('avatar-male-041', 'Male avatar 41', '/avatars/male/avatar_041.png', array['personnel']::public.icon_entity_type[], '{male}', 1041, 'male'),
  ('avatar-male-042', 'Male avatar 42', '/avatars/male/avatar_042.png', array['personnel']::public.icon_entity_type[], '{male}', 1042, 'male'),
  ('avatar-male-057', 'Male avatar 57', '/avatars/male/avatar_057.png', array['personnel']::public.icon_entity_type[], '{male}', 1057, 'male'),
  ('avatar-male-059', 'Male avatar 59', '/avatars/male/avatar_059.png', array['personnel']::public.icon_entity_type[], '{male}', 1059, 'male'),
  ('avatar-male-060', 'Male avatar 60', '/avatars/male/avatar_060.png', array['personnel']::public.icon_entity_type[], '{male}', 1060, 'male'),
  ('avatar-male-061', 'Male avatar 61', '/avatars/male/avatar_061.png', array['personnel']::public.icon_entity_type[], '{male}', 1061, 'male'),
  ('avatar-male-064', 'Male avatar 64', '/avatars/male/avatar_064.png', array['personnel']::public.icon_entity_type[], '{male}', 1064, 'male'),
  ('avatar-male-065', 'Male avatar 65', '/avatars/male/avatar_065.png', array['personnel']::public.icon_entity_type[], '{male}', 1065, 'male'),
  ('avatar-male-066', 'Male avatar 66', '/avatars/male/avatar_066.png', array['personnel']::public.icon_entity_type[], '{male}', 1066, 'male'),
  ('avatar-male-067', 'Male avatar 67', '/avatars/male/avatar_067.png', array['personnel']::public.icon_entity_type[], '{male}', 1067, 'male'),
  ('avatar-male-068', 'Male avatar 68', '/avatars/male/avatar_068.png', array['personnel']::public.icon_entity_type[], '{male}', 1068, 'male'),
  ('avatar-male-069', 'Male avatar 69', '/avatars/male/avatar_069.png', array['personnel']::public.icon_entity_type[], '{male}', 1069, 'male'),
  ('avatar-male-070', 'Male avatar 70', '/avatars/male/avatar_070.png', array['personnel']::public.icon_entity_type[], '{male}', 1070, 'male'),
  ('avatar-male-071', 'Male avatar 71', '/avatars/male/avatar_071.png', array['personnel']::public.icon_entity_type[], '{male}', 1071, 'male'),
  ('avatar-male-073', 'Male avatar 73', '/avatars/male/avatar_073.png', array['personnel']::public.icon_entity_type[], '{male}', 1073, 'male'),
  ('avatar-male-074', 'Male avatar 74', '/avatars/male/avatar_074.png', array['personnel']::public.icon_entity_type[], '{male}', 1074, 'male'),
  ('avatar-male-076', 'Male avatar 76', '/avatars/male/avatar_076.png', array['personnel']::public.icon_entity_type[], '{male}', 1076, 'male'),
  ('avatar-male-077', 'Male avatar 77', '/avatars/male/avatar_077.png', array['personnel']::public.icon_entity_type[], '{male}', 1077, 'male'),
  ('avatar-male-085', 'Male avatar 85', '/avatars/male/avatar_085.png', array['personnel']::public.icon_entity_type[], '{male}', 1085, 'male'),
  ('avatar-male-086', 'Male avatar 86', '/avatars/male/avatar_086.png', array['personnel']::public.icon_entity_type[], '{male}', 1086, 'male'),
  ('avatar-male-087', 'Male avatar 87', '/avatars/male/avatar_087.png', array['personnel']::public.icon_entity_type[], '{male}', 1087, 'male'),
  ('avatar-male-088', 'Male avatar 88', '/avatars/male/avatar_088.png', array['personnel']::public.icon_entity_type[], '{male}', 1088, 'male'),
  ('avatar-male-089', 'Male avatar 89', '/avatars/male/avatar_089.png', array['personnel']::public.icon_entity_type[], '{male}', 1089, 'male'),
  ('avatar-male-090', 'Male avatar 90', '/avatars/male/avatar_090.png', array['personnel']::public.icon_entity_type[], '{male}', 1090, 'male'),
  ('avatar-male-091', 'Male avatar 91', '/avatars/male/avatar_091.png', array['personnel']::public.icon_entity_type[], '{male}', 1091, 'male'),
  ('avatar-male-092', 'Male avatar 92', '/avatars/male/avatar_092.png', array['personnel']::public.icon_entity_type[], '{male}', 1092, 'male'),
  ('avatar-male-093', 'Male avatar 93', '/avatars/male/avatar_093.png', array['personnel']::public.icon_entity_type[], '{male}', 1093, 'male'),
  ('avatar-male-094', 'Male avatar 94', '/avatars/male/avatar_094.png', array['personnel']::public.icon_entity_type[], '{male}', 1094, 'male'),
  ('avatar-male-095', 'Male avatar 95', '/avatars/male/avatar_095.png', array['personnel']::public.icon_entity_type[], '{male}', 1095, 'male'),
  ('avatar-male-096', 'Male avatar 96', '/avatars/male/avatar_096.png', array['personnel']::public.icon_entity_type[], '{male}', 1096, 'male'),
  ('avatar-male-098', 'Male avatar 98', '/avatars/male/avatar_098.png', array['personnel']::public.icon_entity_type[], '{male}', 1098, 'male'),
  ('avatar-female-002', 'Female avatar 2', '/avatars/female/avatar_002.png', array['personnel']::public.icon_entity_type[], '{female}', 2002, 'female'),
  ('avatar-female-004', 'Female avatar 4', '/avatars/female/avatar_004.png', array['personnel']::public.icon_entity_type[], '{female}', 2004, 'female'),
  ('avatar-female-005', 'Female avatar 5', '/avatars/female/avatar_005.png', array['personnel']::public.icon_entity_type[], '{female}', 2005, 'female'),
  ('avatar-female-007', 'Female avatar 7', '/avatars/female/avatar_007.png', array['personnel']::public.icon_entity_type[], '{female}', 2007, 'female'),
  ('avatar-female-010', 'Female avatar 10', '/avatars/female/avatar_010.png', array['personnel']::public.icon_entity_type[], '{female}', 2010, 'female'),
  ('avatar-female-013', 'Female avatar 13', '/avatars/female/avatar_013.png', array['personnel']::public.icon_entity_type[], '{female}', 2013, 'female'),
  ('avatar-female-015', 'Female avatar 15', '/avatars/female/avatar_015.png', array['personnel']::public.icon_entity_type[], '{female}', 2015, 'female'),
  ('avatar-female-017', 'Female avatar 17', '/avatars/female/avatar_017.png', array['personnel']::public.icon_entity_type[], '{female}', 2017, 'female'),
  ('avatar-female-018', 'Female avatar 18', '/avatars/female/avatar_018.png', array['personnel']::public.icon_entity_type[], '{female}', 2018, 'female'),
  ('avatar-female-019', 'Female avatar 19', '/avatars/female/avatar_019.png', array['personnel']::public.icon_entity_type[], '{female}', 2019, 'female'),
  ('avatar-female-020', 'Female avatar 20', '/avatars/female/avatar_020.png', array['personnel']::public.icon_entity_type[], '{female}', 2020, 'female'),
  ('avatar-female-025', 'Female avatar 25', '/avatars/female/avatar_025.png', array['personnel']::public.icon_entity_type[], '{female}', 2025, 'female'),
  ('avatar-female-027', 'Female avatar 27', '/avatars/female/avatar_027.png', array['personnel']::public.icon_entity_type[], '{female}', 2027, 'female'),
  ('avatar-female-028', 'Female avatar 28', '/avatars/female/avatar_028.png', array['personnel']::public.icon_entity_type[], '{female}', 2028, 'female'),
  ('avatar-female-043', 'Female avatar 43', '/avatars/female/avatar_043.png', array['personnel']::public.icon_entity_type[], '{female}', 2043, 'female'),
  ('avatar-female-044', 'Female avatar 44', '/avatars/female/avatar_044.png', array['personnel']::public.icon_entity_type[], '{female}', 2044, 'female'),
  ('avatar-female-045', 'Female avatar 45', '/avatars/female/avatar_045.png', array['personnel']::public.icon_entity_type[], '{female}', 2045, 'female'),
  ('avatar-female-046', 'Female avatar 46', '/avatars/female/avatar_046.png', array['personnel']::public.icon_entity_type[], '{female}', 2046, 'female'),
  ('avatar-female-047', 'Female avatar 47', '/avatars/female/avatar_047.png', array['personnel']::public.icon_entity_type[], '{female}', 2047, 'female'),
  ('avatar-female-048', 'Female avatar 48', '/avatars/female/avatar_048.png', array['personnel']::public.icon_entity_type[], '{female}', 2048, 'female'),
  ('avatar-female-049', 'Female avatar 49', '/avatars/female/avatar_049.png', array['personnel']::public.icon_entity_type[], '{female}', 2049, 'female'),
  ('avatar-female-050', 'Female avatar 50', '/avatars/female/avatar_050.png', array['personnel']::public.icon_entity_type[], '{female}', 2050, 'female'),
  ('avatar-female-051', 'Female avatar 51', '/avatars/female/avatar_051.png', array['personnel']::public.icon_entity_type[], '{female}', 2051, 'female'),
  ('avatar-female-052', 'Female avatar 52', '/avatars/female/avatar_052.png', array['personnel']::public.icon_entity_type[], '{female}', 2052, 'female'),
  ('avatar-female-053', 'Female avatar 53', '/avatars/female/avatar_053.png', array['personnel']::public.icon_entity_type[], '{female}', 2053, 'female'),
  ('avatar-female-054', 'Female avatar 54', '/avatars/female/avatar_054.png', array['personnel']::public.icon_entity_type[], '{female}', 2054, 'female'),
  ('avatar-female-055', 'Female avatar 55', '/avatars/female/avatar_055.png', array['personnel']::public.icon_entity_type[], '{female}', 2055, 'female'),
  ('avatar-female-056', 'Female avatar 56', '/avatars/female/avatar_056.png', array['personnel']::public.icon_entity_type[], '{female}', 2056, 'female'),
  ('avatar-female-058', 'Female avatar 58', '/avatars/female/avatar_058.png', array['personnel']::public.icon_entity_type[], '{female}', 2058, 'female'),
  ('avatar-female-062', 'Female avatar 62', '/avatars/female/avatar_062.png', array['personnel']::public.icon_entity_type[], '{female}', 2062, 'female'),
  ('avatar-female-063', 'Female avatar 63', '/avatars/female/avatar_063.png', array['personnel']::public.icon_entity_type[], '{female}', 2063, 'female'),
  ('avatar-female-072', 'Female avatar 72', '/avatars/female/avatar_072.png', array['personnel']::public.icon_entity_type[], '{female}', 2072, 'female'),
  ('avatar-female-075', 'Female avatar 75', '/avatars/female/avatar_075.png', array['personnel']::public.icon_entity_type[], '{female}', 2075, 'female'),
  ('avatar-female-078', 'Female avatar 78', '/avatars/female/avatar_078.png', array['personnel']::public.icon_entity_type[], '{female}', 2078, 'female'),
  ('avatar-female-079', 'Female avatar 79', '/avatars/female/avatar_079.png', array['personnel']::public.icon_entity_type[], '{female}', 2079, 'female'),
  ('avatar-female-080', 'Female avatar 80', '/avatars/female/avatar_080.png', array['personnel']::public.icon_entity_type[], '{female}', 2080, 'female'),
  ('avatar-female-081', 'Female avatar 81', '/avatars/female/avatar_081.png', array['personnel']::public.icon_entity_type[], '{female}', 2081, 'female'),
  ('avatar-female-082', 'Female avatar 82', '/avatars/female/avatar_082.png', array['personnel']::public.icon_entity_type[], '{female}', 2082, 'female'),
  ('avatar-female-083', 'Female avatar 83', '/avatars/female/avatar_083.png', array['personnel']::public.icon_entity_type[], '{female}', 2083, 'female'),
  ('avatar-female-084', 'Female avatar 84', '/avatars/female/avatar_084.png', array['personnel']::public.icon_entity_type[], '{female}', 2084, 'female'),
  ('avatar-female-097', 'Female avatar 97', '/avatars/female/avatar_097.png', array['personnel']::public.icon_entity_type[], '{female}', 2097, 'female'),
  ('avatar-female-099', 'Female avatar 99', '/avatars/female/avatar_099.png', array['personnel']::public.icon_entity_type[], '{female}', 2099, 'female'),
  ('avatar-female-100', 'Female avatar 100', '/avatars/female/avatar_100.png', array['personnel']::public.icon_entity_type[], '{female}', 2100, 'female'),
  ('avatar-female-101', 'Female avatar 101', '/avatars/female/avatar_101.png', array['personnel']::public.icon_entity_type[], '{female}', 2101, 'female'),
  ('avatar-female-102', 'Female avatar 102', '/avatars/female/avatar_102.png', array['personnel']::public.icon_entity_type[], '{female}', 2102, 'female'),
  ('avatar-female-103', 'Female avatar 103', '/avatars/female/avatar_103.png', array['personnel']::public.icon_entity_type[], '{female}', 2103, 'female'),
  ('avatar-female-104', 'Female avatar 104', '/avatars/female/avatar_104.png', array['personnel']::public.icon_entity_type[], '{female}', 2104, 'female'),
  ('avatar-female-105', 'Female avatar 105', '/avatars/female/avatar_105.png', array['personnel']::public.icon_entity_type[], '{female}', 2105, 'female'),
  ('avatar-female-106', 'Female avatar 106', '/avatars/female/avatar_106.png', array['personnel']::public.icon_entity_type[], '{female}', 2106, 'female'),
  ('avatar-female-107', 'Female avatar 107', '/avatars/female/avatar_107.png', array['personnel']::public.icon_entity_type[], '{female}', 2107, 'female'),
  ('avatar-female-108', 'Female avatar 108', '/avatars/female/avatar_108.png', array['personnel']::public.icon_entity_type[], '{female}', 2108, 'female'),
  ('avatar-female-109', 'Female avatar 109', '/avatars/female/avatar_109.png', array['personnel']::public.icon_entity_type[], '{female}', 2109, 'female'),
  ('avatar-female-110', 'Female avatar 110', '/avatars/female/avatar_110.png', array['personnel']::public.icon_entity_type[], '{female}', 2110, 'female'),
  ('avatar-female-111', 'Female avatar 111', '/avatars/female/avatar_111.png', array['personnel']::public.icon_entity_type[], '{female}', 2111, 'female'),
  ('avatar-female-112', 'Female avatar 112', '/avatars/female/avatar_112.png', array['personnel']::public.icon_entity_type[], '{female}', 2112, 'female');

update public.personnel
set
  icon_id = 'avatar-female-002',
  avatar_gender = 'female'
where icon_id in ('person-default', 'person-01', 'person-02', 'person-03', 'person-04', 'person-05', 'person-06', 'person-07', 'person-08', 'person-09', 'person-10', 'person-11');

alter table public.personnel
  alter column icon_id set default 'avatar-female-002';

delete from public.app_icons
where id in ('person-default', 'person-01', 'person-02', 'person-03', 'person-04', 'person-05', 'person-06', 'person-07', 'person-08', 'person-09', 'person-10', 'person-11');


-- === 20260901100000_pharmacy_role_icons.sql ===
-- Pharmacy role icon pack for company roles.

insert into public.app_icons (id, label, path, entity_types, tags, sort_order) values
  ('role-accountant', 'Accountant', '/icons/pharmacy-roles/accountant.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2101),
  ('role-administrator', 'Administrator', '/icons/pharmacy-roles/administrator.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2102),
  ('role-cashier', 'Cashier', '/icons/pharmacy-roles/cashier.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2103),
  ('role-cleaner-maintenance', 'Cleaner Maintenance', '/icons/pharmacy-roles/cleaner-maintenance.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2104),
  ('role-compounding-technician', 'Compounding Technician', '/icons/pharmacy-roles/compounding-technician.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2105),
  ('role-customer-service', 'Customer Service', '/icons/pharmacy-roles/customer-service.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2106),
  ('role-delivery-courier', 'Delivery Courier', '/icons/pharmacy-roles/delivery-courier.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2107),
  ('role-generic-employee', 'Generic Employee', '/icons/pharmacy-roles/generic-employee.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2108),
  ('role-hr-personnel', 'Hr Personnel', '/icons/pharmacy-roles/hr-personnel.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2109),
  ('role-inventory-manager', 'Inventory Manager', '/icons/pharmacy-roles/inventory-manager.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2110),
  ('role-manager', 'Manager', '/icons/pharmacy-roles/manager.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2111),
  ('role-medical-advisor', 'Medical Advisor', '/icons/pharmacy-roles/medical-advisor.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2112),
  ('role-owner', 'Owner', '/icons/pharmacy-roles/owner.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2113),
  ('role-pharmacist', 'Pharmacist', '/icons/pharmacy-roles/pharmacist.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2114),
  ('role-pharmacy-clerk', 'Pharmacy Clerk', '/icons/pharmacy-roles/pharmacy-clerk.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2115),
  ('role-purchasing', 'Purchasing', '/icons/pharmacy-roles/purchasing.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2116),
  ('role-sales-associate', 'Sales Associate', '/icons/pharmacy-roles/sales-associate.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2117),
  ('role-security', 'Security', '/icons/pharmacy-roles/security.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2118),
  ('role-shift-supervisor', 'Shift Supervisor', '/icons/pharmacy-roles/shift-supervisor.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2119),
  ('role-trainee', 'Trainee', '/icons/pharmacy-roles/trainee.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2120);

update public.company_roles
set icon_id = case icon_id
  when 'role-user-cog' then 'role-manager'
  when 'role-pill' then 'role-pharmacist'
  when 'role-eye' then 'role-generic-employee'
  else icon_id
end;

alter table public.company_roles
  alter column icon_id set default 'role-manager';

delete from public.app_icons
where id in ('role-user-cog', 'role-pill', 'role-eye');


-- === 20260901120000_device_subscriptions_push.sql ===
create table public.device_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  channel text not null check (channel in ('fcm', 'web_push')),
  token text not null,
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, platform, token)
);

alter table public.notification_jobs
  add column if not exists push_sent_at timestamptz;

create index device_subscriptions_user_idx on public.device_subscriptions (user_id);
create index device_subscriptions_org_idx on public.device_subscriptions (organization_id);
create index notification_jobs_push_dispatch_idx
  on public.notification_jobs (status, push_sent_at, scheduled_for)
  where push_sent_at is null;

alter table public.device_subscriptions enable row level security;

create policy "Users can read their device subscriptions"
  on public.device_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their device subscriptions"
  on public.device_subscriptions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_permission(organization_id, 'organization.read')
  );

create policy "Users can update their device subscriptions"
  on public.device_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their device subscriptions"
  on public.device_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());


-- === seed.sql ===
insert into public.role_permissions (role, permission)
values
  ('developer_admin', 'platform.admin'),
  ('developer_admin', 'platform.users.read'),
  ('developer_admin', 'platform.users.update'),
  ('developer_admin', 'platform.users.delete'),
  ('developer_admin', 'platform.tenants.read'),
  ('developer_admin', 'platform.tenants.update'),
  ('developer_admin', 'platform.tenants.delete'),
  ('developer_admin', 'platform.records.hard_delete'),
  ('developer_admin', 'organization.read'),
  ('developer_admin', 'organization.update'),
  ('developer_admin', 'users.invite'),
  ('developer_admin', 'users.disable'),
  ('developer_admin', 'roles.manage'),
  ('developer_admin', 'locations.manage'),
  ('developer_admin', 'personnel.manage'),
  ('developer_admin', 'shifts.read'),
  ('developer_admin', 'shifts.create'),
  ('developer_admin', 'shifts.update'),
  ('developer_admin', 'shifts.delete'),
  ('developer_admin', 'shifts.assign'),
  ('developer_admin', 'notes.read'),
  ('developer_admin', 'notes.create'),
  ('developer_admin', 'notes.update'),
  ('developer_admin', 'notes.delete'),
  ('developer_admin', 'notes.acknowledge'),
  ('developer_admin', 'notifications.manage'),
  ('developer_admin', 'audit.read'),
  ('developer_admin', 'stats.read'),
  ('owner', 'organization.read'),
  ('owner', 'organization.update'),
  ('owner', 'users.invite'),
  ('owner', 'users.disable'),
  ('owner', 'roles.manage'),
  ('owner', 'locations.manage'),
  ('owner', 'personnel.manage'),
  ('owner', 'shifts.read'),
  ('owner', 'shifts.create'),
  ('owner', 'shifts.update'),
  ('owner', 'shifts.delete'),
  ('owner', 'shifts.assign'),
  ('owner', 'notes.read'),
  ('owner', 'notes.create'),
  ('owner', 'notes.update'),
  ('owner', 'notes.delete'),
  ('owner', 'notes.acknowledge'),
  ('owner', 'notifications.manage'),
  ('owner', 'audit.read'),
  ('owner', 'stats.read'),
  ('manager', 'organization.read'),
  ('manager', 'users.invite'),
  ('manager', 'personnel.manage'),
  ('manager', 'shifts.read'),
  ('manager', 'shifts.create'),
  ('manager', 'shifts.update'),
  ('manager', 'shifts.assign'),
  ('manager', 'notes.read'),
  ('manager', 'notes.create'),
  ('manager', 'notes.update'),
  ('manager', 'notes.acknowledge'),
  ('manager', 'notifications.manage'),
  ('manager', 'stats.read'),
  ('personnel', 'organization.read'),
  ('personnel', 'shifts.read'),
  ('personnel', 'notes.read'),
  ('personnel', 'notes.acknowledge'),
  ('viewer', 'organization.read'),
  ('viewer', 'shifts.read'),
  ('viewer', 'notes.read')
on conflict do nothing;
