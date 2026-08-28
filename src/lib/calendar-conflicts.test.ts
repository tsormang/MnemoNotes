import { describe, expect, it } from 'vitest'
import { findShiftConflicts } from './calendar-conflicts'
import type { CalendarItem } from '../types/domain'

const baseItem = (overrides: Partial<CalendarItem>): CalendarItem => ({
  id: 'a',
  kind: 'shift',
  title: 'Morning',
  startsAt: '2026-08-28T08:00:00.000Z',
  endsAt: '2026-08-28T14:00:00.000Z',
  locationId: 'loc-1',
  assignedPersonnelIds: ['p1'],
  priority: 'normal',
  notificationOffsets: [],
  requiresAcknowledgement: false,
  ...overrides,
})

describe('findShiftConflicts', () => {
  it('returns empty when kinds are not shifts', () => {
    const items = [baseItem({ id: 'note-1', kind: 'note' })]
    expect(
      findShiftConflicts(items, {
        id: 'new',
        kind: 'note',
        startsAt: '2026-08-28T09:00:00.000Z',
        endsAt: '2026-08-28T10:00:00.000Z',
        assignedPersonnelIds: ['p1'],
      }),
    ).toEqual([])
  })

  it('detects overlapping shifts for the same person', () => {
    const items = [baseItem({ id: 'existing' })]
    const conflicts = findShiftConflicts(items, {
      id: 'new',
      kind: 'shift',
      startsAt: '2026-08-28T10:00:00.000Z',
      endsAt: '2026-08-28T16:00:00.000Z',
      assignedPersonnelIds: ['p1'],
    })

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.conflictingItemId).toBe('existing')
  })

  it('ignores the item being edited', () => {
    const items = [baseItem({ id: 'self' })]
    expect(
      findShiftConflicts(items, {
        id: 'self',
        kind: 'shift',
        startsAt: '2026-08-28T08:00:00.000Z',
        endsAt: '2026-08-28T14:00:00.000Z',
        assignedPersonnelIds: ['p1'],
      }),
    ).toEqual([])
  })

  it('allows adjacent non-overlapping shifts', () => {
    const items = [baseItem({ id: 'early', endsAt: '2026-08-28T08:00:00.000Z' })]
    expect(
      findShiftConflicts(items, {
        id: 'later',
        kind: 'shift',
        startsAt: '2026-08-28T08:00:00.000Z',
        endsAt: '2026-08-28T12:00:00.000Z',
        assignedPersonnelIds: ['p1'],
      }),
    ).toEqual([])
  })
})
