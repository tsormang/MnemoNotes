import type { AvatarGender, AppIcon, IconEntityType, NoteIconCollection } from './types'
import { STATIC_APP_ICONS } from './static-icons'
import {
  DEFAULT_PERSONNEL_AVATAR_BY_GENDER,
  PERSONNEL_AVATAR_ICONS,
} from './personnel-avatars.generated'
import { DEFAULT_NOTE_ICON_BY_COLLECTION, NOTE_ICONS } from './note-icons.generated'
import { DEFAULT_ROLE_ICON_ID, ROLE_ICONS } from './role-icons.generated'
import { DEFAULT_ICON_IDS } from './defaults'

/** Offline catalog: static icons + generated personnel avatars + role + note icon sets. */
export const FALLBACK_APP_ICONS: AppIcon[] = [
  ...STATIC_APP_ICONS,
  ...PERSONNEL_AVATAR_ICONS,
  ...ROLE_ICONS,
  ...NOTE_ICONS,
]

export function buildIconLookup(icons: AppIcon[]): Map<string, AppIcon> {
  return new Map(icons.map((icon) => [icon.id, icon]))
}

export function iconsForEntityType(
  icons: AppIcon[],
  entityType: IconEntityType,
  avatarGender?: AvatarGender,
  noteIconCollection?: NoteIconCollection,
): AppIcon[] {
  return icons.filter((icon) => {
    if (!icon.entityTypes.includes(entityType)) return false
    if (entityType === 'personnel' && avatarGender) {
      return icon.avatarGender === avatarGender
    }
    if (entityType === 'note') {
      if (noteIconCollection) {
        return icon.noteIconCollection === noteIconCollection
      }
      return Boolean(icon.noteIconCollection)
    }
    return true
  })
}

export function resolveIconPath(
  lookup: Map<string, AppIcon>,
  iconId: string | null | undefined,
  entityType: IconEntityType,
  avatarGender?: AvatarGender,
  noteIconCollection?: NoteIconCollection,
): string {
  const resolvedId =
    iconId?.trim() || defaultIconIdForEntity(entityType, avatarGender, noteIconCollection)
  return (
    lookup.get(resolvedId)?.path ??
    lookup.get(defaultIconIdForEntity(entityType, avatarGender, noteIconCollection))?.path ??
    ''
  )
}

export function defaultIconIdForEntity(
  entityType: IconEntityType,
  avatarGender: AvatarGender = 'female',
  noteIconCollection: NoteIconCollection = 'medical',
): string {
  if (entityType === 'personnel') {
    return DEFAULT_PERSONNEL_AVATAR_BY_GENDER[avatarGender]
  }
  if (entityType === 'note') {
    return DEFAULT_NOTE_ICON_BY_COLLECTION[noteIconCollection]
  }
  if (entityType === 'company_role') {
    return DEFAULT_ROLE_ICON_ID
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

export function iconMatchesNoteCollection(
  lookup: Map<string, AppIcon>,
  iconId: string | null | undefined,
  noteIconCollection: NoteIconCollection,
): boolean {
  if (!iconId) return false
  const icon = lookup.get(iconId)
  return icon?.noteIconCollection === noteIconCollection
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

export { DEFAULT_PERSONNEL_AVATAR_BY_GENDER, DEFAULT_NOTE_ICON_BY_COLLECTION }
