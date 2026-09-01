import type { AppIcon } from './types'

/** Non-personnel icons from the app catalog (organizations, roles, notes, tasks). */
export const STATIC_APP_ICONS: AppIcon[] = [
  { id: 'org-default', label: 'Default company', path: '/icons/entities/org-default.svg', entityTypes: ['organization'], tags: [], sortOrder: 0 },
  { id: 'org-pharmacy', label: 'Pharmacy', path: '/icons/entities/org-pharmacy.svg', entityTypes: ['organization'], tags: ['pharmacy'], sortOrder: 1 },
  { id: 'org-clinic', label: 'Clinic', path: '/icons/entities/org-clinic.svg', entityTypes: ['organization'], tags: ['clinic'], sortOrder: 2 },
  { id: 'org-store', label: 'Store', path: '/icons/entities/org-store.svg', entityTypes: ['organization'], tags: ['store'], sortOrder: 3 },
  { id: 'note-default', label: 'Default note', path: '/icons/entities/note-default.svg', entityTypes: ['note'], tags: [], sortOrder: 40 },
  { id: 'note-stock', label: 'Stock', path: '/icons/entities/note-stock.svg', entityTypes: ['note'], tags: ['stock'], sortOrder: 41 },
  { id: 'note-handover', label: 'Handover', path: '/icons/entities/note-handover.svg', entityTypes: ['note'], tags: ['handover'], sortOrder: 42 },
  { id: 'note-delivery', label: 'Delivery', path: '/icons/entities/note-delivery.svg', entityTypes: ['note'], tags: ['delivery'], sortOrder: 43 },
  { id: 'note-alert', label: 'Alert', path: '/icons/entities/note-alert.svg', entityTypes: ['note'], tags: ['alert'], sortOrder: 44 },
  { id: 'note-info', label: 'Info', path: '/icons/entities/note-info.svg', entityTypes: ['note'], tags: ['info'], sortOrder: 45 },
  { id: 'task-default', label: 'Default task', path: '/icons/entities/task-default.svg', entityTypes: ['task'], tags: [], sortOrder: 50 },
  { id: 'task-checklist', label: 'Checklist', path: '/icons/entities/task-checklist.svg', entityTypes: ['task'], tags: ['checklist'], sortOrder: 51 },
  { id: 'task-phone', label: 'Phone', path: '/icons/entities/task-phone.svg', entityTypes: ['task'], tags: ['phone'], sortOrder: 52 },
  { id: 'task-cleaning', label: 'Cleaning', path: '/icons/entities/task-cleaning.svg', entityTypes: ['task'], tags: ['cleaning'], sortOrder: 53 },
]
