import { describe, expect, it } from 'vitest'
import { formatShiftStaffLabel, getCalendarItemDisplayLabel } from './calendar-display'
import type { CalendarItem } from '../types/domain'

const personnel = [
  { id: 'p1', fullName: 'Alex Smith' },
  { id: 'p2', fullName: 'Jordan Lee' },
  { id: 'p3', fullName: 'Sam Patel' },
]

describe('calendar-display', () => {
  it('shows assigned staff for shifts instead of title', () => {
    const item: Pick<CalendarItem, 'kind' | 'title' | 'assignedPersonnelIds'> = {
      kind: 'shift',
      title: '',
      assignedPersonnelIds: ['p1', 'p2'],
    }

    expect(getCalendarItemDisplayLabel(item, personnel)).toBe('Alex Smith, Jordan Lee')
  })

  it('falls back when a shift has no assignees', () => {
    const item: Pick<CalendarItem, 'kind' | 'title' | 'assignedPersonnelIds'> = {
      kind: 'shift',
      title: '',
      assignedPersonnelIds: [],
    }

    expect(formatShiftStaffLabel([])).toBe('Unassigned shift')
    expect(getCalendarItemDisplayLabel(item, personnel)).toBe('Unassigned shift')
  })

  it('keeps title for notes and tasks', () => {
    const item: Pick<CalendarItem, 'kind' | 'title' | 'assignedPersonnelIds'> = {
      kind: 'note',
      title: 'Stock check',
      assignedPersonnelIds: [],
    }

    expect(getCalendarItemDisplayLabel(item, personnel)).toBe('Stock check')
  })
})
