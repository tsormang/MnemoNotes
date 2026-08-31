export interface DefaultCompanyRole {
  name: string
  description: string
  iconId: string
  permissions: string[]
}

export const defaultCompanyRoles: DefaultCompanyRole[] = [
  {
    name: 'Manager',
    description: 'Delegated scheduling and personnel management',
    iconId: 'role-user-cog',
    permissions: [
      'organization.read',
      'users.invite',
      'personnel.manage',
      'shifts.read',
      'shifts.create',
      'shifts.update',
      'shifts.assign',
      'notes.read',
      'notes.create',
      'notes.update',
      'notes.acknowledge',
      'notifications.manage',
      'stats.read',
    ],
  },
  {
    name: 'Pharmacist',
    description: 'Front-line staff with shift visibility and note acknowledgements',
    iconId: 'role-pill',
    permissions: ['organization.read', 'shifts.read', 'notes.read', 'notes.acknowledge'],
  },
  {
    name: 'Viewer',
    description: 'Read-only operational visibility',
    iconId: 'role-eye',
    permissions: ['organization.read', 'shifts.read', 'notes.read'],
  },
]
