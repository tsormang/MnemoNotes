import { describe, expect, it } from 'vitest'
import {
  FALLBACK_APP_ICONS,
  buildIconLookup,
  iconsForEntityType,
  personnelInitials,
  resolveIconPath,
  shouldUsePersonnelInitials,
} from './fallback-catalog'

describe('icon catalog helpers', () => {
  const lookup = buildIconLookup(FALLBACK_APP_ICONS)

  it('resolves known avatar paths', () => {
    expect(resolveIconPath(lookup, 'avatar-female-004', 'personnel', 'female')).toBe(
      '/avatars/female/avatar_004.png',
    )
  })

  it('filters personnel avatars by gender', () => {
    const femaleAvatars = iconsForEntityType(FALLBACK_APP_ICONS, 'personnel', 'female')
    expect(femaleAvatars.length).toBeGreaterThan(0)
    expect(femaleAvatars.every((icon) => icon.avatarGender === 'female')).toBe(true)
  })

  it('falls back to gender default', () => {
    expect(resolveIconPath(lookup, 'missing-icon', 'personnel', 'male')).toBe(
      '/avatars/male/avatar_001.png',
    )
  })

  it('uses initials only when icon id is missing', () => {
    expect(shouldUsePersonnelInitials('avatar-female-002')).toBe(false)
    expect(shouldUsePersonnelInitials(undefined)).toBe(true)
  })

  it('builds personnel initials', () => {
    expect(personnelInitials('Maria Antoniou')).toBe('MA')
  })
})
