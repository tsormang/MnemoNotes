export type AppRole = 'developer_admin' | 'owner' | 'manager' | 'personnel' | 'viewer'

export type AppPermission =
  | 'platform.admin'
  | 'platform.users.read'
  | 'platform.users.update'
  | 'platform.users.delete'
  | 'platform.tenants.read'
  | 'platform.tenants.update'
  | 'platform.tenants.delete'
  | 'platform.records.hard_delete'
  | 'organization.read'
  | 'organization.update'
  | 'users.invite'
  | 'users.disable'
  | 'roles.manage'
  | 'locations.manage'
  | 'personnel.manage'
  | 'shifts.read'
  | 'shifts.create'
  | 'shifts.update'
  | 'shifts.delete'
  | 'shifts.assign'
  | 'notes.read'
  | 'notes.create'
  | 'notes.update'
  | 'notes.delete'
  | 'notes.acknowledge'
  | 'notifications.manage'
  | 'audit.read'

export type CalendarItemKind = 'shift' | 'note' | 'task'

export type NotificationTrigger = 'before_start' | 'at_start' | 'during' | 'before_end' | 'after_end'

export type PersonnelStatus = 'active' | 'invited' | 'inactive' | 'disabled'

/** Whether personnel has a linked app login, pending invite, or roster-only record. */
export type PersonnelAccountLink = 'linked' | 'invited' | 'unlinked'

export interface CompanyRole {
  id: string
  organizationId: string
  name: string
  description: string
  icon: string
  permissions: AppPermission[]
}

export interface Organization {
  id: string
  name: string
  timezone: string
  workingDayStart: string
  workingDayEnd: string
}

export interface PharmacyLocation {
  id: string
  name: string
  address: string
  timezone: string
  openingHours: string
}

/** Organization-level calendar window (24-hour `HH:mm`). */
export interface WorkingDayHours {
  start: string
  end: string
}

export interface Personnel {
  id: string
  fullName: string
  companyRoleId: string
  companyRoleName: string
  title: string
  status: PersonnelStatus
  skills: string[]
  locationId: string
  profileId?: string | null
  inviteEmail?: string | null
  accountLink: PersonnelAccountLink
}

export interface PersonnelInvite {
  id: string
  personnelId: string
  email: string
  expiresAt: string
  acceptedAt: string | null
}

export interface CalendarItem {
  id: string
  kind: CalendarItemKind
  title: string
  description?: string
  startsAt: string
  endsAt: string
  locationId: string
  assignedPersonnelIds: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  noteCategory?: string
  seriesId?: string
  notificationOffsets: number[]
  requiresAcknowledgement: boolean
}

export interface WorkspaceMembership {
  organizationId: string
  organizationName: string
  systemRole: AppRole | null
  personnelId: string | null
  companyRoleId: string | null
  permissions: AppPermission[]
}

export interface AuditLogEntry {
  id: string
  organizationId: string | null
  action: string
  entityTable: string
  entityId: string | null
  createdAt: string
  actorUserId: string | null
}
