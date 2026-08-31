import type { TFunction } from 'i18next'
import type { AppPermission } from '../types/domain'
import { permissionGroups as basePermissionGroups } from './permissions'

const groupKeyByLabel: Record<string, string> = {
  Organization: 'organization',
  People: 'people',
  Shifts: 'shifts',
  Notes: 'notes',
  Other: 'other',
}

export function translatePermissionLabel(
  permission: AppPermission,
  t: TFunction<'people'>,
): string {
  return t(`roles.permissions.${permission}`)
}

export function translatePermissionGroupLabel(groupLabel: string, t: TFunction<'people'>): string {
  const key = groupKeyByLabel[groupLabel]
  return key ? t(`roles.groups.${key}`) : groupLabel
}

export function usePermissionGroupsWithLabels(t: TFunction<'people'>) {
  return basePermissionGroups.map((group) => ({
    ...group,
    label: translatePermissionGroupLabel(group.label, t),
    permissions: group.permissions,
  }))
}
