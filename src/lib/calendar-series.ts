import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  getDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarItem } from '../types/domain'

export type SeriesDuplicateMode = 'next-day' | 'week' | 'month'

export type CalendarSeriesViewId = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'

export interface CalendarSeriesViewContext {
  activeView: CalendarSeriesViewId
  /** FullCalendar active range (`start` inclusive, `end` exclusive). */
  visibleRange: { start: Date; end: Date }
  /** Calendar anchor date from `calendar.getDate()` — the month/week/day being viewed. */
  calendarDate: Date
}

export interface DuplicateTarget {
  startsAt: string
  endsAt: string
}

/** Sunday — schedule copies never target this day (manual creation only). */
export function isSunday(day: Date): boolean {
  return getDay(day) === 0
}

export function parseSeriesId(metadata: Record<string, unknown> | null | undefined): string | undefined {
  return typeof metadata?.seriesId === 'string' && metadata.seriesId.length > 0
    ? metadata.seriesId
    : undefined
}

export function shiftIsoRange(startsAt: string, endsAt: string, dayOffset: number): DuplicateTarget {
  return {
    startsAt: addDays(parseISO(startsAt), dayOffset).toISOString(),
    endsAt: addDays(parseISO(endsAt), dayOffset).toISOString(),
  }
}

/** Days in the week the user is currently viewing (or the event's week in month view). */
export function getVisibleWeekDays(
  context: CalendarSeriesViewContext,
  sourceStartsAt: string,
): Date[] {
  const { activeView, visibleRange } = context

  if (activeView === 'timeGridWeek') {
    const rangeStart = startOfDay(visibleRange.start)
    const exclusiveEnd = startOfDay(visibleRange.end)
    const rangeEnd =
      exclusiveEnd.getTime() > rangeStart.getTime() ? addDays(exclusiveEnd, -1) : rangeStart
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  }

  if (activeView === 'timeGridDay') {
    const focus = startOfDay(visibleRange.start)
    return eachDayOfInterval({
      start: startOfWeek(focus, { weekStartsOn: 1 }),
      end: endOfWeek(focus, { weekStartsOn: 1 }),
    })
  }

  const focus = startOfDay(parseISO(sourceStartsAt))
  return eachDayOfInterval({
    start: startOfWeek(focus, { weekStartsOn: 1 }),
    end: endOfWeek(focus, { weekStartsOn: 1 }),
  })
}

/** Days in the calendar month currently being viewed. */
export function getVisibleMonthDays(calendarDate: Date): Date[] {
  return eachDayOfInterval({
    start: startOfMonth(calendarDate),
    end: endOfMonth(calendarDate),
  })
}

export function buildDuplicateTargets(
  item: Pick<CalendarItem, 'startsAt' | 'endsAt'>,
  mode: SeriesDuplicateMode,
  context: CalendarSeriesViewContext,
): DuplicateTarget[] {
  const sourceDay = startOfDay(parseISO(item.startsAt))

  if (mode === 'next-day') {
    const nextDay = addDays(sourceDay, 1)
    if (isSunday(nextDay)) {
      return []
    }
    return [shiftIsoRange(item.startsAt, item.endsAt, 1)]
  }

  const days =
    mode === 'week'
      ? getVisibleWeekDays(context, item.startsAt)
      : getVisibleMonthDays(context.calendarDate)

  const targets: DuplicateTarget[] = []

  for (const day of days) {
    const offset = differenceInCalendarDays(day, sourceDay)
    if (offset === 0) continue
    if (isSunday(day)) continue
    targets.push(shiftIsoRange(item.startsAt, item.endsAt, offset))
  }

  return targets
}

export function getSeriesSiblings(items: CalendarItem[], item: CalendarItem): CalendarItem[] {
  if (!item.seriesId) return [item]
  return items.filter((entry) => entry.seriesId === item.seriesId)
}
