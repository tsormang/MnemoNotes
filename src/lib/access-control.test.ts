import { describe, expect, it } from 'vitest'
import { can, rolePermissions } from './access-control'

describe('role permissions', () => {
  it('allows owners to manage users and assign shifts', () => {
    expect(can('owner', 'users.invite')).toBe(true)
    expect(can('owner', 'shifts.assign')).toBe(true)
  })

  it('keeps personnel away from role management', () => {
    expect(can('personnel', 'roles.manage')).toBe(false)
    expect(rolePermissions.personnel).toContain('notes.acknowledge')
  })
})
