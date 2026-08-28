import { addDays, formatISO, setHours, startOfToday } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '../../types/domain'
import { buildWorkspaceStatsReport } from './aggregate'

const today = startOfToday()

const personnel = [
  { id: 'a', fullName: 'Alice', companyRoleName: 'Manager' },
  { id: 'b', fullName: 'Bob', companyRoleName: 'Pharmacist' },
]

function shift(id: string, startHour: number, endHour: number, assignees: string[]): CalendarItem {
  return {
    id,
    kind: 'shift',
    title: id,
    startsAt: formatISO(setHours(today, startHour)),
    endsAt: formatISO(setHours(today, endHour)),
    locationId: 'loc',
    assignedPersonnelIds: assignees,
    priority: 'normal',
    notificationOffsets: [],
    requiresAcknowledgement: false,
  }
}

describe('buildWorkspaceStatsReport', () => {
  it('aggregates shift hours per assignee and daily totals', () => {
    const range = { start: today, end: addDays(today, 1) }
    const report = buildWorkspaceStatsReport({
      range,
      rangeLabel: 'Today',
      personnel,
      items: [
        shift('s1', 8, 14, ['a', 'b']),
        shift('s2', 9, 12, []),
        {
          id: 'n1',
          kind: 'note',
          title: 'Stock check',
          startsAt: formatISO(setHours(today, 10)),
          endsAt: formatISO(setHours(today, 11)),
          locationId: 'loc',
          assignedPersonnelIds: ['a'],
          priority: 'normal',
          notificationOffsets: [],
          requiresAcknowledgement: false,
        },
      ],
    })

    expect(report.totalShifts).toBe(2)
    expect(report.totalShiftHours).toBe(9)
    expect(report.unassignedShifts).toBe(1)
    expect(report.totalNotes).toBe(1)

    const alice = report.personnelRows.find((row) => row.personnelId === 'a')
    expect(alice?.shiftHours).toBe(6)
    expect(alice?.shiftCount).toBe(1)
    expect(alice?.noteCount).toBe(1)

    const bob = report.personnelRows.find((row) => row.personnelId === 'b')
    expect(bob?.shiftHours).toBe(6)
    expect(report.dailyShiftHours[0]?.hours).toBe(9)
  })
})
