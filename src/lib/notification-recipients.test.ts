import { describe, expect, it } from 'vitest'
import { collectNonShiftRecipientIds } from './notification-recipients'

describe('collectNonShiftRecipientIds', () => {
  it('includes org members even when they are not on the personnel roster', () => {
    expect(
      collectNonShiftRecipientIds({
        memberUserIds: ['owner-1'],
        personnelProfileIds: [],
        createdBy: 'owner-1',
      }),
    ).toEqual(['owner-1'])
  })

  it('unions members, linked personnel, and the event creator', () => {
    expect(
      collectNonShiftRecipientIds({
        memberUserIds: ['owner-1', 'manager-1'],
        personnelProfileIds: ['staff-1', null],
        createdBy: 'owner-1',
      }).sort(),
    ).toEqual(['manager-1', 'owner-1', 'staff-1'])
  })
})
