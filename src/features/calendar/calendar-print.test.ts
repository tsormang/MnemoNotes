import { describe, expect, it } from 'vitest'
import type { CalendarItem, Personnel } from '../../types/domain'
import {
  buildSchedulePrintFilename,
  buildSchedulePrintModel,
  resolveSchedulePrintRange,
} from './calendar-print'

const labels = {
  viewDay: 'Day',
  viewWeek: 'Week',
  viewMonth: 'Month',
  allDay: 'All day',
  emptyDay: 'No events scheduled',
  untitled: 'Untitled',
  unassignedShift: 'Unassigned shift',
  kindShift: 'Shift',
  kindNote: 'Note',
  kindTask: 'Task',
}

const personnel: Personnel[] = [
  {
    id: 'p1',
    fullName: 'Alex Smith',
    companyRoleId: 'r1',
    companyRoleName: 'Pharmacist',
    title: '',
    status: 'active',
    skills: [],
    locationId: 'loc1',
    accountLink: 'linked',
    iconId: 'avatar-1',
    avatarGender: 'male',
    colorKey: 'blue',
  },
]

function item(overrides: Partial<CalendarItem> & Pick<CalendarItem, 'kind' | 'startsAt' | 'endsAt'>): CalendarItem {
  return {
    id: overrides.id ?? 'item-1',
    title: overrides.title ?? 'Stock note',
    assignedPersonnelIds: overrides.assignedPersonnelIds ?? [],
    locationId: 'loc1',
    priority: 'normal',
    notificationOffsets: [],
    requiresAcknowledgement: false,
    ...overrides,
  }
}

describe('resolveSchedulePrintRange', () => {
  it('uses the selected local day', () => {
    const range = resolveSchedulePrintRange('day', new Date(2026, 8, 3, 15, 30))
    expect(range.start).toEqual(new Date(2026, 8, 3))
    expect(range.end).toEqual(new Date(2026, 8, 4))
  })

  it('uses Monday-start week of the selected date', () => {
    const range = resolveSchedulePrintRange('week', new Date(2026, 8, 3))
    expect(range.start).toEqual(new Date(2026, 7, 31))
    expect(range.end).toEqual(new Date(2026, 8, 7))
  })

  it('uses the calendar month of the selected date', () => {
    const range = resolveSchedulePrintRange('month', new Date(2026, 8, 15))
    expect(range.start).toEqual(new Date(2026, 8, 1))
    expect(range.end).toEqual(new Date(2026, 9, 1))
  })
})

describe('buildSchedulePrintFilename', () => {
  it('names files from the selected scope and start date', () => {
    expect(buildSchedulePrintFilename('day', new Date(2026, 8, 3))).toBe(
      'mnemonotes-schedule_day_2026-09-03.pdf',
    )
    expect(buildSchedulePrintFilename('week', new Date(2026, 7, 31))).toBe(
      'mnemonotes-schedule_week_2026-08-31.pdf',
    )
    expect(buildSchedulePrintFilename('month', new Date(2026, 8, 1))).toBe(
      'mnemonotes-schedule_month_2026-09.pdf',
    )
  })
})

describe('buildSchedulePrintModel', () => {
  it('groups events onto overlapping days and keeps empty days', () => {
    const model = buildSchedulePrintModel({
      scope: 'week',
      anchorDate: new Date(2026, 8, 3),
      organizationName: 'Green Cross',
      brandName: 'MnemoNotes',
      rangeLabel: '31 Aug – 6 Sep 2026',
      labels,
      formatDayHeading: (day) => day.toISOString().slice(0, 10),
      personnel,
      items: [
        item({
          id: 'shift-1',
          kind: 'shift',
          title: '',
          assignedPersonnelIds: ['p1'],
          startsAt: new Date(2026, 8, 3, 7, 0).toISOString(),
          endsAt: new Date(2026, 8, 3, 15, 0).toISOString(),
        }),
        item({
          id: 'note-1',
          kind: 'note',
          allDay: true,
          startsAt: new Date(2026, 8, 3, 0, 0).toISOString(),
          endsAt: new Date(2026, 8, 4, 0, 0).toISOString(),
        }),
      ],
    })

    expect(model.viewLabel).toBe('Week')
    expect(model.days).toHaveLength(7)
    const thursday = model.days.find((day) => day.dateKey === '2026-09-03')
    expect(thursday?.events.map((event) => event.title)).toEqual(['Stock note', 'Alex Smith'])
    expect(thursday?.events[0]?.timeLabel).toBe('All day')
    expect(model.days[0]?.events).toEqual([])
    expect(model.emptyDay).toBe('No events scheduled')
  })
})
