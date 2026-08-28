-- Phase 4: seed stats.read for roles that can view workforce analytics
insert into public.role_permissions (role, permission)
values
  ('developer_admin', 'stats.read'),
  ('owner', 'stats.read'),
  ('manager', 'stats.read')
on conflict do nothing;
