import { describe, expect, it } from 'vitest'
import {
  buildDuplicateTargets,
  getSeriesSiblings,
  getVisibleWeekDays,
  shiftIsoRange,
  type CalendarSeriesViewContext,
} from './calendar-series'
import type { CalendarItem } from '../types/domain'

const baseItem: Pick<CalendarItem, 'startsAt' | 'endsAt' | 'seriesId'> = {
  startsAt: '2026-08-27T06:00:00.000Z',
  endsAt: '2026-08-27T14:00:00.000Z',
  seriesId: 'series-1',
}

describe('calendar-series', () => {
  it('shifts a range by whole days', () => {
    const shifted = shiftIsoRange(baseItem.startsAt, baseItem.endsAt, 1)
    expect(new Date(shifted.startsAt).getDate()).toBe(28)
    expect(new Date(shifted.endsAt).getDate()).toBe(28)
  })

  it('uses the exact visible week range in week view', () => {
    const weekStart = new Date(2026, 7, 24, 0, 0, 0, 0)
    const weekEnd = new Date(2026, 7, 31, 0, 0, 0, 0)
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridWeek',
      visibleRange: { start: weekStart, end: weekEnd },
      calendarDate: new Date(2026, 7, 27, 0, 0, 0, 0),
    }

    const days = getVisibleWeekDays(context, baseItem.startsAt)
    expect(days).toHaveLength(7)
    expect(days[0].getDate()).toBe(24)
    expect(days[6].getDate()).toBe(30)

    const targets = buildDuplicateTargets(baseItem, 'week', context, [])
    expect(targets).toHaveLength(6)
  })

  it('does not use month-grid padding when building week targets from month view', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'dayGridMonth',
      visibleRange: {
        start: new Date(2026, 6, 27, 0, 0, 0, 0),
        end: new Date(2026, 8, 7, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 1, 0, 0, 0, 0),
    }

    const days = getVisibleWeekDays(context, baseItem.startsAt)
    expect(days[0].getDate()).toBe(24)
    expect(days[6].getDate()).toBe(30)
  })

  it('skips days that already have a series instance', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridWeek',
      visibleRange: {
        start: new Date(2026, 7, 24, 0, 0, 0, 0),
        end: new Date(2026, 7, 31, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 27, 0, 0, 0, 0),
    }
    const existing = [
      {
        startsAt: '2026-08-28T06:00:00.000Z',
        seriesId: 'series-1',
      },
    ]
    const targets = buildDuplicateTargets(baseItem, 'week', context, existing)
    expect(targets.some((target) => target.startsAt.startsWith('2026-08-28'))).toBe(false)
  })

  it('groups siblings by series id', () => {
    const items: CalendarItem[] = [
      {
        id: 'a',
        kind: 'shift',
        title: '',
        startsAt: baseItem.startsAt,
        endsAt: baseItem.endsAt,
        locationId: 'loc',
        assignedPersonnelIds: [],
        priority: 'normal',
        seriesId: 'series-1',
        notificationOffsets: [],
        requiresAcknowledgement: false,
      },
      {
        id: 'b',
        kind: 'shift',
        title: '',
        startsAt: '2026-08-28T06:00:00.000Z',
        endsAt: '2026-08-28T14:00:00.000Z',
        locationId: 'loc',
        assignedPersonnelIds: [],
        priority: 'normal',
        seriesId: 'series-1',
        notificationOffsets: [],
        requiresAcknowledgement: false,
      },
      {
        id: 'c',
        kind: 'shift',
        title: '',
        startsAt: '2026-08-29T06:00:00.000Z',
        endsAt: '2026-08-29T14:00:00.000Z',
        locationId: 'loc',
        assignedPersonnelIds: [],
        priority: 'normal',
        seriesId: 'series-2',
        notificationOffsets: [],
        requiresAcknowledgement: false,
      },
    ]

    expect(getSeriesSiblings(items, items[0])).toHaveLength(2)
  })
})
