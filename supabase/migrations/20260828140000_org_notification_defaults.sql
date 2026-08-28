-- Organization-level notification defaults (reminder offset presets).

alter table public.organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.settings is
  'Org-wide settings JSON. notificationDefaults: { shift, ackRequired, note, task } minute offsets.';
