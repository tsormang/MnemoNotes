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
