-- Allow personnel managers to read pending invites for their organization.

create policy "Personnel managers can read personnel invites"
  on public.personnel_invites for select
  to authenticated
  using (public.has_permission(organization_id, 'personnel.manage'));
