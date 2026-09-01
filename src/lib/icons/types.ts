export type IconEntityType = 'organization' | 'personnel' | 'company_role' | 'note' | 'task'

export type AvatarGender = 'male' | 'female'

export type NoteIconCollection = 'finance' | 'medical'

export interface AppIcon {
  id: string
  label: string
  path: string
  entityTypes: IconEntityType[]
  tags: string[]
  sortOrder: number
  /** Set for personnel avatars so pickers can filter male/female collections. */
  avatarGender?: AvatarGender | null
  /** Set for note icons so pickers can filter finance/medical collections. */
  noteIconCollection?: NoteIconCollection | null
}

export type IconAvatarSize = 'sm' | 'md' | 'lg' | 'xl'
