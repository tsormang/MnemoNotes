import { describe, expect, it } from 'vitest'
import {
  buildHourTicks,
  buildShiftOverlapDiagram,
  clipShiftToDayWindow,
} from './calendar-shift-overlap'
import type { CalendarItem, Personnel } from '../types/domain'

function localIso(year: number, monthIndex: number, day: number, hour: number, minute = 0): string {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString()
}

const day = new Date(2026, 8, 11) // 11 Sep 2026 local

const baseShift = (overrides: Partial<CalendarItem>): CalendarItem => ({
  id: 'shift-1',
  kind: 'shift',
  title: 'Morning',
  startsAt: localIso(2026, 8, 11, 8),
  endsAt: localIso(2026, 8, 11, 14),
  locationId: 'loc-1',
  assignedPersonnelIds: ['p1'],
  notificationOffsets: [],
  requiresAcknowledgement: false,
  ...overrides,
})

const person = (id: string, name: string): Personnel => ({
  id,
  fullName: name,
  companyRoleId: 'role-1',
  companyRoleName: 'Pharmacist',
  title: '',
  status: 'active',
  skills: [],
  locationId: 'loc-1',
  accountLink: 'linked',
  iconId: 'avatar-1',
  avatarGender: 'female',
  colorKey: 'blue',
})

describe('clipShiftToDayWindow', () => {
  it('clips a shift to the visible working-day window', () => {
    const ranges = clipShiftToDayWindow(
      localIso(2026, 8, 11, 6),
      localIso(2026, 8, 11, 10),
      day,
      7 * 60,
      21 * 60,
    )
    expect(ranges).toEqual([{ startMinutes: 7 * 60, endMinutes: 10 * 60 }])
  })

  it('returns empty when the shift is outside the window', () => {
    expect(
      clipShiftToDayWindow(
        localIso(2026, 8, 11, 22),
        localIso(2026, 8, 12, 6),
        day,
        7 * 60,
        21 * 60,
      ),
    ).toEqual([])
  })

  it('keeps the overnight portion that lands on the focused day', () => {
    const onStartDay = clipShiftToDayWindow(
      localIso(2026, 8, 11, 22),
      localIso(2026, 8, 12, 6),
      day,
      0,
      24 * 60,
    )
    expect(onStartDay).toEqual([{ startMinutes: 22 * 60, endMinutes: 24 * 60 }])

    const onEndDay = clipShiftToDayWindow(
      localIso(2026, 8, 11, 22),
      localIso(2026, 8, 12, 6),
      new Date(2026, 8, 12),
      0,
      24 * 60,
    )
    expect(onEndDay).toEqual([{ startMinutes: 0, endMinutes: 6 * 60 }])
  })
})

describe('buildHourTicks', () => {
  it('emits hour marks across the window', () => {
    const ticks = buildHourTicks(7 * 60, 21 * 60)
    expect(ticks[0]).toMatchObject({ minutes: 7 * 60, label: '07:00', leftPercent: 0 })
    expect(ticks.at(-1)).toMatchObject({ minutes: 21 * 60, label: '21:00', leftPercent: 100 })
    expect(ticks.some((tick) => tick.minutes === 12 * 60)).toBe(true)
  })
})

describe('buildShiftOverlapDiagram', () => {
  it('returns empty lanes when there are no day shifts', () => {
    const diagram = buildShiftOverlapDiagram(
      [baseShift({ kind: 'note', id: 'note-1' })],
      day,
      '07:00',
      '21:00',
    )
    expect(diagram.lanes).toEqual([])
  })

  it('places geometry as percentages within the window', () => {
    const diagram = buildShiftOverlapDiagram(
      [baseShift({ startsAt: localIso(2026, 8, 11, 9), endsAt: localIso(2026, 8, 11, 13) })],
      day,
      '07:00',
      '21:00',
      [person('p1', 'Alex')],
    )

    expect(diagram.lanes).toHaveLength(1)
    const segment = diagram.lanes[0]?.segments[0]
    expect(segment?.leftPercent).toBeCloseTo(((9 - 7) / 14) * 100)
    expect(segment?.widthPercent).toBeCloseTo((4 / 14) * 100)
    expect(segment?.labelStart).toBe('09:00')
    expect(segment?.labelEnd).toBe('13:00')
  })

  it('creates one lane per assignee for multi-person shifts', () => {
    const diagram = buildShiftOverlapDiagram(
      [
        baseShift({
          id: 'shared',
          assignedPersonnelIds: ['p1', 'p2'],
          startsAt: localIso(2026, 8, 11, 10),
          endsAt: localIso(2026, 8, 11, 12),
        }),
      ],
      day,
      '07:00',
      '21:00',
      [person('p2', 'Bella'), person('p1', 'Alex')],
    )

    expect(diagram.lanes.map((lane) => lane.personnelId)).toEqual(['p2', 'p1'])
    expect(diagram.lanes.every((lane) => lane.segments.length === 1)).toBe(true)
  })

  it('puts unassigned shifts in a fallback lane', () => {
    const diagram = buildShiftOverlapDiagram(
      [baseShift({ assignedPersonnelIds: [] })],
      day,
      '07:00',
      '21:00',
    )
    expect(diagram.lanes).toHaveLength(1)
    expect(diagram.lanes[0]?.personnelId).toBeNull()
  })

  it('splits overnight shifts across days when the window is 00:00–24:00', () => {
    const overnight = baseShift({
      id: 'night',
      startsAt: localIso(2026, 8, 11, 22),
      endsAt: localIso(2026, 8, 12, 6),
    })

    const dayOne = buildShiftOverlapDiagram([overnight], day, '00:00', '24:00')
    expect(dayOne.lanes[0]?.segments).toHaveLength(1)
    expect(dayOne.lanes[0]?.segments[0]?.labelStart).toBe('22:00')
    expect(dayOne.lanes[0]?.segments[0]?.labelEnd).toBe('24:00')

    const dayTwo = buildShiftOverlapDiagram(
      [overnight],
      new Date(2026, 8, 12),
      '00:00',
      '24:00',
    )
    expect(dayTwo.lanes[0]?.segments[0]?.labelStart).toBe('00:00')
    expect(dayTwo.lanes[0]?.segments[0]?.labelEnd).toBe('06:00')
  })
})
