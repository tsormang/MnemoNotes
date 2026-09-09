-- Self-serve owner registration requests awaiting platform-admin review.

create type public.registration_request_status as enum ('pending', 'approved', 'rejected');

create table public.organization_registration_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  company_name text not null,
  timezone text not null default 'Europe/Athens',
  auth_user_id uuid references auth.users on delete set null,
  status public.registration_request_status not null default 'pending',
  organization_id uuid references public.organizations on delete set null,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organization_registration_requests_pending_email_idx
  on public.organization_registration_requests (lower(email))
  where status = 'pending';

create index organization_registration_requests_status_idx
  on public.organization_registration_requests (status, created_at desc);

create index organization_registration_requests_auth_user_idx
  on public.organization_registration_requests (auth_user_id)
  where auth_user_id is not null;

alter table public.organization_registration_requests enable row level security;

create policy "Users can read their own registration requests"
  on public.organization_registration_requests for select
  to authenticated
  using (auth_user_id = auth.uid() or public.is_platform_admin());
