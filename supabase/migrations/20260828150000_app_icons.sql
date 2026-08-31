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
