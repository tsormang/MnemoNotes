-- Manual platform admin (if npm run admin:create cannot run yet)
--
-- 1) Supabase Dashboard → Authentication → Users → Add user
--    Email: your ADMIN_EMAIL, password: your ADMIN_PASSWORD, Auto-confirm user: ON
-- 2) Copy the new user's UUID from the users list
-- 3) Replace USER_UUID below and run in SQL Editor

insert into public.profiles (id, full_name, timezone)
values ('USER_UUID', 'Developer Admin', 'Europe/Athens')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.platform_admins (user_id)
values ('USER_UUID')
on conflict (user_id) do nothing;
