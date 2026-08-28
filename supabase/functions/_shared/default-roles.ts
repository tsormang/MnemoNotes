export interface DefaultCompanyRole {
  name: string
  description: string
  icon: string
  permissions: string[]
}

export const defaultCompanyRoles: DefaultCompanyRole[] = [
  {
    name: 'Manager',
    description: 'Delegated scheduling and personnel management',
    icon: 'user-cog',
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
    ],
  },
  {
    name: 'Pharmacist',
    description: 'Front-line staff with shift visibility and note acknowledgements',
    icon: 'pill',
    permissions: ['organization.read', 'shifts.read', 'notes.read', 'notes.acknowledge'],
  },
  {
    name: 'Viewer',
    description: 'Read-only operational visibility',
    icon: 'eye',
    permissions: ['organization.read', 'shifts.read', 'notes.read'],
  },
]
