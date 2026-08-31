export type IconEntityType = 'organization' | 'personnel' | 'company_role' | 'note' | 'task'

export type AvatarGender = 'male' | 'female'

export interface AppIcon {
  id: string
  label: string
  path: string
  entityTypes: IconEntityType[]
  tags: string[]
  sortOrder: number
  /** Set for personnel avatars so pickers can filter male/female collections. */
  avatarGender?: AvatarGender | null
}

export type IconAvatarSize = 'sm' | 'md' | 'lg' | 'xl'
