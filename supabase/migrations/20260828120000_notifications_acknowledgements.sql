-- Phase 3: acknowledgements, notification rule sync, recipient job updates

create table public.calendar_item_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  calendar_item_id uuid not null references public.calendar_items on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (calendar_item_id, user_id)
);

alter table public.calendar_item_acknowledgements enable row level security;

create policy "Members can read acknowledgements"
  on public.calendar_item_acknowledgements for select
  to authenticated
  using (public.has_permission(organization_id, 'organization.read'));

create policy "Users can acknowledge items in their org"
  on public.calendar_item_acknowledgements for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_permission(organization_id, 'notes.acknowledge')
  );

create index calendar_item_ack_item_idx
  on public.calendar_item_acknowledgements (calendar_item_id);

create index calendar_item_ack_user_idx
  on public.calendar_item_acknowledgements (user_id, organization_id);

-- Recipients may mark their own in-app jobs as acknowledged
create policy "Recipients can acknowledge notification jobs"
  on public.notification_jobs for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create or replace function public.sync_calendar_notification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offsets jsonb;
  offset_val integer;
begin
  delete from public.notification_rules where calendar_item_id = new.id;

  offsets := new.metadata -> 'notificationOffsets';
  if offsets is null or jsonb_typeof(offsets) <> 'array' then
    return new;
  end if;

  for offset_val in
    select value::integer
    from jsonb_array_elements_text(offsets) as value
  loop
    insert into public.notification_rules (
      organization_id,
      calendar_item_id,
      trigger_kind,
      offset_minutes,
      channel,
      enabled
    )
    values (
      new.organization_id,
      new.id,
      case
        when offset_val < 0 then 'before_start'::public.notification_trigger
        when offset_val = 0 then 'at_start'::public.notification_trigger
        else 'during'::public.notification_trigger
      end,
      abs(offset_val),
      'in_app',
      true
    );
  end loop;

  return new;
end;
$$;

create trigger calendar_items_sync_notification_rules
  after insert or update of metadata, starts_at, ends_at
  on public.calendar_items
  for each row
  execute function public.sync_calendar_notification_rules();
