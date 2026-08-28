const actionLabels: Record<string, string> = {
  'company.provisioned': 'Company provisioned',
  'owner.invited': 'Owner invited',
  'owner.invite_accepted': 'Owner invite accepted',
  'personnel.invited': 'Personnel invited',
  'personnel.invite_accepted': 'Personnel invite accepted',
}

const entityTableLabels: Record<string, string> = {
  organizations: 'Company',
  organization_owner_invites: 'Owner invite',
  personnel: 'Personnel',
  personnel_invites: 'Personnel invite',
  calendar_items: 'Calendar item',
  company_roles: 'Company role',
  shift_assignments: 'Shift assignment',
}

export function formatAuditAction(action: string): string {
  return actionLabels[action] ?? action.replaceAll('.', ' · ')
}

export function formatAuditEntityTable(table: string): string {
  return entityTableLabels[table] ?? table.replaceAll('_', ' ')
}
