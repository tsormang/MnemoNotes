-- Pharmacy role icon pack for company roles.

insert into public.app_icons (id, label, path, entity_types, tags, sort_order) values
  ('role-accountant', 'Accountant', '/icons/pharmacy-roles/accountant.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2101),
  ('role-administrator', 'Administrator', '/icons/pharmacy-roles/administrator.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2102),
  ('role-cashier', 'Cashier', '/icons/pharmacy-roles/cashier.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2103),
  ('role-cleaner-maintenance', 'Cleaner Maintenance', '/icons/pharmacy-roles/cleaner-maintenance.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2104),
  ('role-compounding-technician', 'Compounding Technician', '/icons/pharmacy-roles/compounding-technician.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2105),
  ('role-customer-service', 'Customer Service', '/icons/pharmacy-roles/customer-service.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2106),
  ('role-delivery-courier', 'Delivery Courier', '/icons/pharmacy-roles/delivery-courier.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2107),
  ('role-generic-employee', 'Generic Employee', '/icons/pharmacy-roles/generic-employee.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2108),
  ('role-hr-personnel', 'Hr Personnel', '/icons/pharmacy-roles/hr-personnel.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2109),
  ('role-inventory-manager', 'Inventory Manager', '/icons/pharmacy-roles/inventory-manager.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2110),
  ('role-manager', 'Manager', '/icons/pharmacy-roles/manager.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2111),
  ('role-medical-advisor', 'Medical Advisor', '/icons/pharmacy-roles/medical-advisor.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2112),
  ('role-owner', 'Owner', '/icons/pharmacy-roles/owner.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2113),
  ('role-pharmacist', 'Pharmacist', '/icons/pharmacy-roles/pharmacist.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2114),
  ('role-pharmacy-clerk', 'Pharmacy Clerk', '/icons/pharmacy-roles/pharmacy-clerk.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2115),
  ('role-purchasing', 'Purchasing', '/icons/pharmacy-roles/purchasing.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2116),
  ('role-sales-associate', 'Sales Associate', '/icons/pharmacy-roles/sales-associate.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2117),
  ('role-security', 'Security', '/icons/pharmacy-roles/security.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2118),
  ('role-shift-supervisor', 'Shift Supervisor', '/icons/pharmacy-roles/shift-supervisor.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2119),
  ('role-trainee', 'Trainee', '/icons/pharmacy-roles/trainee.png', array['company_role']::public.icon_entity_type[], '{pharmacy}', 2120);

update public.company_roles
set icon_id = case icon_id
  when 'role-user-cog' then 'role-manager'
  when 'role-pill' then 'role-pharmacist'
  when 'role-eye' then 'role-generic-employee'
  else icon_id
end;

alter table public.company_roles
  alter column icon_id set default 'role-manager';

delete from public.app_icons
where id in ('role-user-cog', 'role-pill', 'role-eye');
