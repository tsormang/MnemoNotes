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
  ('personnel', 'organization.read'),
  ('personnel', 'shifts.read'),
  ('personnel', 'notes.read'),
  ('personnel', 'notes.acknowledge'),
  ('viewer', 'organization.read'),
  ('viewer', 'shifts.read'),
  ('viewer', 'notes.read')
on conflict do nothing;
