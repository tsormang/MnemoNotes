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
