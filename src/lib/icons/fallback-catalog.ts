import type { AvatarGender, AppIcon, IconEntityType } from './types'
import { STATIC_APP_ICONS } from './static-icons'
import {
  DEFAULT_PERSONNEL_AVATAR_BY_GENDER,
  PERSONNEL_AVATAR_ICONS,
} from './personnel-avatars.generated'
import { DEFAULT_ICON_IDS } from './defaults'

/** Offline catalog: static icons + generated personnel avatars. */
export const FALLBACK_APP_ICONS: AppIcon[] = [...STATIC_APP_ICONS, ...PERSONNEL_AVATAR_ICONS]

export function buildIconLookup(icons: AppIcon[]): Map<string, AppIcon> {
  return new Map(icons.map((icon) => [icon.id, icon]))
}

export function iconsForEntityType(
  icons: AppIcon[],
  entityType: IconEntityType,
  avatarGender?: AvatarGender,
): AppIcon[] {
  return icons.filter((icon) => {
    if (!icon.entityTypes.includes(entityType)) return false
    if (entityType !== 'personnel' || !avatarGender) return true
    return icon.avatarGender === avatarGender
  })
}

export function resolveIconPath(
  lookup: Map<string, AppIcon>,
  iconId: string | null | undefined,
  entityType: IconEntityType,
  avatarGender?: AvatarGender,
): string {
  const resolvedId = iconId?.trim() || defaultIconIdForEntity(entityType, avatarGender)
  return lookup.get(resolvedId)?.path ?? lookup.get(defaultIconIdForEntity(entityType, avatarGender))?.path ?? ''
}

export function defaultIconIdForEntity(
  entityType: IconEntityType,
  avatarGender: AvatarGender = 'female',
): string {
  if (entityType === 'personnel') {
    return DEFAULT_PERSONNEL_AVATAR_BY_GENDER[avatarGender]
  }
  return DEFAULT_ICON_IDS[entityType]
}

export function iconMatchesAvatarGender(
  lookup: Map<string, AppIcon>,
  iconId: string | null | undefined,
  avatarGender: AvatarGender,
): boolean {
  if (!iconId) return false
  const icon = lookup.get(iconId)
  return icon?.avatarGender === avatarGender
}

export function personnelInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function shouldUsePersonnelInitials(iconId: string | null | undefined): boolean {
  return !iconId?.trim()
}

export { DEFAULT_PERSONNEL_AVATAR_BY_GENDER }
