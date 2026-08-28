import type { AppPermission, CalendarItemKind } from '../types/domain'

const shiftPerms = {
  create: 'shifts.create' as AppPermission,
  update: 'shifts.update' as AppPermission,
  delete: 'shifts.delete' as AppPermission,
  assign: 'shifts.assign' as AppPermission,
  read: 'shifts.read' as AppPermission,
}

const notePerms = {
  create: 'notes.create' as AppPermission,
  update: 'notes.update' as AppPermission,
  delete: 'notes.delete' as AppPermission,
  read: 'notes.read' as AppPermission,
}

export function permissionsForKind(kind: CalendarItemKind) {
  return kind === 'shift' ? shiftPerms : notePerms
}

export function canReadKind(
  can: (permission: AppPermission) => boolean,
  kind: CalendarItemKind,
): boolean {
  return can(permissionsForKind(kind).read)
}

export function canCreateKind(
  can: (permission: AppPermission) => boolean,
  kind: CalendarItemKind,
): boolean {
  return can(permissionsForKind(kind).create)
}

export function canUpdateKind(
  can: (permission: AppPermission) => boolean,
  kind: CalendarItemKind,
): boolean {
  return can(permissionsForKind(kind).update)
}

export function canDeleteKind(
  can: (permission: AppPermission) => boolean,
  kind: CalendarItemKind,
): boolean {
  return can(permissionsForKind(kind).delete)
}

export function canAssignShifts(can: (permission: AppPermission) => boolean): boolean {
  return can('shifts.assign')
}

export function canEditCalendarItem(
  can: (permission: AppPermission) => boolean,
  kind: CalendarItemKind,
): boolean {
  return canUpdateKind(can, kind)
}

export function canCreateAnyCalendarItem(can: (permission: AppPermission) => boolean): boolean {
  return canCreateKind(can, 'shift') || canCreateKind(can, 'note') || canCreateKind(can, 'task')
}
