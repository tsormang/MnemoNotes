-- Named color keys for personnel and company roles (calendar bubbles / stats).

alter table public.personnel
  add column color_key text not null default 'blue';

alter table public.company_roles
  add column color_key text not null default 'blue';

-- Stable backfill from id hash so existing rows keep distinct-ish colors.
update public.personnel
set color_key = (array['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'olive', 'indigo'])[
  (abs(hashtext(id::text)) % 8) + 1
];

update public.company_roles
set color_key = (array['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'olive', 'indigo'])[
  (abs(hashtext(id::text)) % 8) + 1
];

alter table public.personnel
  add constraint personnel_color_key_check
  check (color_key in ('blue', 'green', 'purple', 'orange', 'teal', 'pink', 'olive', 'indigo'));

alter table public.company_roles
  add constraint company_roles_color_key_check
  check (color_key in ('blue', 'green', 'purple', 'orange', 'teal', 'pink', 'olive', 'indigo'));
