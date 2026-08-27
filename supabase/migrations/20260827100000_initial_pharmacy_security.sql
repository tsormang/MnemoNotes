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
