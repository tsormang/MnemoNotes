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
  | 'stats.read'

export type CalendarItemKind = 'shift' | 'note' | 'task'

export type NotificationTrigger = 'before_start' | 'at_start' | 'during' | 'before_end' | 'after_end'

export type PersonnelStatus = 'active' | 'invited' | 'inactive' | 'disabled'

/** Whether personnel has a linked app login, pending invite, or roster-only record. */
export type PersonnelAccountLink = 'linked' | 'invited' | 'unlinked'

/** Avatar collection for personnel (owners included on the roster). */
export type AvatarGender = 'male' | 'female'

export interface CompanyRole {
  id: string
  organizationId: string
  name: string
  description: string
  iconId: string
  permissions: AppPermission[]
}

export interface Organization {
  id: string
  name: string
  timezone: string
  workingDayStart: string
  workingDayEnd: string
  notificationDefaults: NotificationDefaults
  iconId: string
}

export interface NotificationDefaults {
  shift: number[]
  ackRequired: number[]
  note: number[]
  task: number[]
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
  iconId: string
  avatarGender: AvatarGender
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
  /** When true, the event spans whole calendar day(s) with no specific clock time. */
  allDay?: boolean
  startsAt: string
  endsAt: string
  locationId: string
  assignedPersonnelIds: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  noteCategory?: string
  iconId?: string
  seriesId?: string
  notificationOffsets: number[]
  requiresAcknowledgement: boolean
}

export interface WorkspaceMembership {
  organizationId: string
  /** Organization name without role suffix. */
  organizationName: string
  /** App header subtitle; may include company role for personnel. */
  workspaceLabel: string
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
  actorName?: string
  before?: unknown
  after?: unknown
}
