-- Priority was unused for reminders/UI beyond a stored label; drop the column.
alter table public.calendar_items
  drop column if exists priority;
