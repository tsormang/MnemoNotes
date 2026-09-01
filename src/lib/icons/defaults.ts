import type { CalendarItemKind } from '../../types/domain'
import type { AvatarGender, IconEntityType, NoteIconCollection } from './types'
import { DEFAULT_PERSONNEL_AVATAR_BY_GENDER } from './personnel-avatars.generated'
import { DEFAULT_NOTE_ICON_BY_COLLECTION } from './note-icons.generated'
import { DEFAULT_ROLE_ICON_ID } from './role-icons.generated'

export const DEFAULT_ICON_IDS: Record<Exclude<IconEntityType, 'personnel' | 'note'>, string> = {
  organization: 'org-default',
  company_role: DEFAULT_ROLE_ICON_ID,
  task: 'task-default',
}

export function defaultPersonnelIconId(avatarGender: AvatarGender = 'female'): string {
  return DEFAULT_PERSONNEL_AVATAR_BY_GENDER[avatarGender]
}

export function defaultNoteIconId(noteIconCollection: NoteIconCollection = 'medical'): string {
  return DEFAULT_NOTE_ICON_BY_COLLECTION[noteIconCollection]
}

export function defaultIconIdForKind(kind: CalendarItemKind): string {
  if (kind === 'task') return DEFAULT_ICON_IDS.task
  return defaultNoteIconId('medical')
}

export function defaultIconIdForEntityType(
  entityType: IconEntityType,
  avatarGender: AvatarGender = 'female',
  noteIconCollection: NoteIconCollection = 'medical',
): string {
  if (entityType === 'personnel') {
    return defaultPersonnelIconId(avatarGender)
  }
  if (entityType === 'note') {
    return defaultNoteIconId(noteIconCollection)
  }
  return DEFAULT_ICON_IDS[entityType]
}
