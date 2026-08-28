import type { AppPermission } from '../types/domain'

/** Org-scoped permissions owners can assign to company roles (excludes platform.*). */
export const tenantPermissions: AppPermission[] = [
  'organization.read',
  'organization.update',
  'users.invite',
  'users.disable',
  'roles.manage',
  'locations.manage',
  'personnel.manage',
  'shifts.read',
  'shifts.create',
  'shifts.update',
  'shifts.delete',
  'shifts.assign',
  'notes.read',
  'notes.create',
  'notes.update',
  'notes.delete',
  'notes.acknowledge',
  'notifications.manage',
  'audit.read',
]

export const permissionLabels: Record<AppPermission, string> = {
  'platform.admin': 'Platform admin',
  'platform.users.read': 'Read platform users',
  'platform.users.update': 'Update platform users',
  'platform.users.delete': 'Delete platform users',
  'platform.tenants.read': 'Read tenants',
  'platform.tenants.update': 'Update tenants',
  'platform.tenants.delete': 'Delete tenants',
  'platform.records.hard_delete': 'Hard delete records',
  'organization.read': 'Read organization',
  'organization.update': 'Update organization',
  'users.invite': 'Invite users',
  'users.disable': 'Disable users',
  'roles.manage': 'Manage roles',
  'locations.manage': 'Manage locations',
  'personnel.manage': 'Manage personnel',
  'shifts.read': 'Read shifts',
  'shifts.create': 'Create shifts',
  'shifts.update': 'Update shifts',
  'shifts.delete': 'Delete shifts',
  'shifts.assign': 'Assign shifts',
  'notes.read': 'Read notes',
  'notes.create': 'Create notes',
  'notes.update': 'Update notes',
  'notes.delete': 'Delete notes',
  'notes.acknowledge': 'Acknowledge notes',
  'notifications.manage': 'Manage notifications',
  'audit.read': 'Read audit log',
}

export const permissionGroups: Array<{ label: string; permissions: AppPermission[] }> = [
  {
    label: 'Organization',
    permissions: ['organization.read', 'organization.update', 'locations.manage', 'audit.read'],
  },
  {
    label: 'People',
    permissions: ['users.invite', 'users.disable', 'roles.manage', 'personnel.manage'],
  },
  {
    label: 'Shifts',
    permissions: [
      'shifts.read',
      'shifts.create',
      'shifts.update',
      'shifts.delete',
      'shifts.assign',
    ],
  },
  {
    label: 'Notes',
    permissions: [
      'notes.read',
      'notes.create',
      'notes.update',
      'notes.delete',
      'notes.acknowledge',
    ],
  },
  {
    label: 'Other',
    permissions: ['notifications.manage'],
  },
]
