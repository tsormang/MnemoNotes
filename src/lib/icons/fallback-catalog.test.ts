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

  it('filters note icons by collection', () => {
    const medicalIcons = iconsForEntityType(FALLBACK_APP_ICONS, 'note', undefined, 'medical')
    expect(medicalIcons.length).toBeGreaterThan(0)
    expect(medicalIcons.every((icon) => icon.noteIconCollection === 'medical')).toBe(true)
  })

  it('lists pharmacy role icons for company roles', () => {
    const roleIcons = iconsForEntityType(FALLBACK_APP_ICONS, 'company_role')
    expect(roleIcons.length).toBeGreaterThanOrEqual(20)
    expect(roleIcons.some((icon) => icon.id === 'role-pharmacist')).toBe(true)
    expect(resolveIconPath(lookup, 'role-pharmacist', 'company_role')).toBe(
      '/icons/pharmacy-roles/pharmacist.png',
    )
  })

  it('resolves note icon paths from generated catalog', () => {
    expect(resolveIconPath(lookup, 'note-medical-capsule', 'note', undefined, 'medical')).toBe(
      '/icons/medical-health/capsule-icon.png',
    )
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
