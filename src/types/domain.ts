export type AppRole = 'developer_admin' | 'owner' | 'manager' | 'personnel' | 'viewer'

export type AppPermission =
  | 'platform.admin'
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

export type PersonnelStatus = 'active' | 'invited' | 'inactive'

export interface PharmacyLocation {
  id: string
  name: string
  address: string
  timezone: string
  openingHours: string
}

export interface Personnel {
  id: string
  fullName: string
  role: AppRole
  title: string
  status: PersonnelStatus
  skills: string[]
  locationId: string
}

export interface CalendarItem {
  id: string
  kind: CalendarItemKind
  title: string
  startsAt: string
  endsAt: string
  locationId: string
  assignedPersonnelIds: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  noteCategory?: string
  notificationOffsets: number[]
  requiresAcknowledgement: boolean
}
