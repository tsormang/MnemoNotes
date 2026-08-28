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
