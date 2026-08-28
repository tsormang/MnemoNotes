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
