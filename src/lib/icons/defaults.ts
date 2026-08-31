import type { CalendarItemKind } from '../../types/domain'
import type { AvatarGender, IconEntityType } from './types'
import { DEFAULT_PERSONNEL_AVATAR_BY_GENDER } from './personnel-avatars.generated'

export const DEFAULT_ICON_IDS: Record<Exclude<IconEntityType, 'personnel'>, string> = {
  organization: 'org-default',
  company_role: 'role-user-cog',
  note: 'note-default',
  task: 'task-default',
}

export function defaultPersonnelIconId(avatarGender: AvatarGender = 'female'): string {
  return DEFAULT_PERSONNEL_AVATAR_BY_GENDER[avatarGender]
}

export function defaultIconIdForKind(kind: CalendarItemKind): string {
  return kind === 'task' ? DEFAULT_ICON_IDS.task : DEFAULT_ICON_IDS.note
}

export function defaultIconIdForEntityType(
  entityType: IconEntityType,
  avatarGender: AvatarGender = 'female',
): string {
  if (entityType === 'personnel') {
    return defaultPersonnelIconId(avatarGender)
  }
  return DEFAULT_ICON_IDS[entityType]
}
