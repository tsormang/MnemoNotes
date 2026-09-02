import { describe, expect, it } from 'vitest'
import {
  buildScheduleCopyTargets,
  getScheduleClearItemIds,
} from './calendar-schedule-copy'
import type { CalendarItem } from '../types/domain'
import type { CalendarSeriesViewContext } from './calendar-series'

function makeItem(startsAt: string, id = 'item-1'): CalendarItem {
  return {
    id,
    kind: 'shift',
    title: '',
    startsAt,
    endsAt: startsAt.replace('T06:', 'T14:'),
    locationId: 'loc',
    assignedPersonnelIds: [],
    priority: 'normal',
    notificationOffsets: [],
    requiresAcknowledgement: false,
  }
}

describe('calendar-schedule-copy', () => {
  it('copies a day schedule to the next day but skips Sunday targets', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridDay',
      visibleRange: {
        start: new Date(2026, 7, 29, 0, 0, 0, 0),
        end: new Date(2026, 7, 30, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 29, 0, 0, 0, 0),
    }
    const items = [makeItem('2026-08-29T06:00:00.000Z')]

    const targets = buildScheduleCopyTargets(
      items,
      { scope: 'day', mode: 'next-day' },
      context,
    )
    expect(targets).toHaveLength(0)
  })

  it('copies a day schedule across the visible week excluding Sundays', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridDay',
      visibleRange: {
        start: new Date(2026, 7, 27, 0, 0, 0, 0),
        end: new Date(2026, 7, 28, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 27, 0, 0, 0, 0),
    }
    const items = [makeItem('2026-08-27T06:00:00.000Z')]

    const targets = buildScheduleCopyTargets(items, { scope: 'day', mode: 'week' }, context)
    expect(targets).toHaveLength(5)
    expect(
      targets.every((target) => new Date(target.startsAt).getDay() !== 0),
    ).toBe(true)
  })

  it('copies a week schedule to the next week', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridWeek',
      visibleRange: {
        start: new Date(2026, 7, 24, 0, 0, 0, 0),
        end: new Date(2026, 7, 31, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 27, 0, 0, 0, 0),
    }
    const items = [
      makeItem('2026-08-25T06:00:00.000Z', 'a'),
      makeItem('2026-08-27T06:00:00.000Z', 'b'),
    ]

    const targets = buildScheduleCopyTargets(
      items,
      { scope: 'week', mode: 'next-week' },
      context,
    )
    expect(targets).toHaveLength(2)
    expect(new Date(targets[0].startsAt).getDate()).toBe(1)
    expect(new Date(targets[1].startsAt).getDate()).toBe(3)
  })

  it('copies a month schedule to the next month and skips Sunday targets', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'dayGridMonth',
      visibleRange: {
        start: new Date(2026, 0, 1, 0, 0, 0, 0),
        end: new Date(2026, 1, 1, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 0, 1, 0, 0, 0, 0),
    }
    const items = [makeItem('2026-01-01T06:00:00.000Z')]

    const targets = buildScheduleCopyTargets(
      items,
      { scope: 'month', mode: 'next-month' },
      context,
    )
    expect(targets).toHaveLength(0)
  })

  it('collects clear ids for the visible week', () => {
    const context: CalendarSeriesViewContext = {
      activeView: 'timeGridWeek',
      visibleRange: {
        start: new Date(2026, 7, 24, 0, 0, 0, 0),
        end: new Date(2026, 7, 31, 0, 0, 0, 0),
      },
      calendarDate: new Date(2026, 7, 27, 0, 0, 0, 0),
    }
    const items = [
      makeItem('2026-08-25T06:00:00.000Z', 'a'),
      makeItem('2026-09-01T06:00:00.000Z', 'b'),
    ]

    expect(getScheduleClearItemIds(items, 'week', context)).toEqual(['a'])
  })
})
