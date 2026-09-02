import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  getDay,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import type { CalendarItem } from '../types/domain'
import {
  getVisibleMonthDays,
  getVisibleWeekDays,
  isSunday,
  shiftIsoRange,
  type CalendarSeriesViewContext,
} from './calendar-series'

export type DayScheduleCopyMode = 'next-day' | 'week' | 'month'
export type WeekScheduleCopyMode = 'next-week' | 'month'
export type MonthScheduleCopyMode = 'next-month'

export type ScheduleCopyAction =
  | { scope: 'day'; mode: DayScheduleCopyMode }
  | { scope: 'week'; mode: WeekScheduleCopyMode }
  | { scope: 'month'; mode: MonthScheduleCopyMode }

export type ScheduleClearScope = 'day' | 'week' | 'month'

export type ScheduleAction =
  | { type: 'copy'; copy: ScheduleCopyAction }
  | { type: 'clear'; scope: ScheduleClearScope }

export interface ScheduleCopyTarget {
  sourceItem: CalendarItem
  startsAt: string
  endsAt: string
}

function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((item) => isSameDay(parseISO(item.startsAt), day))
}

function itemsInInclusiveRange(items: CalendarItem[], start: Date, end: Date): CalendarItem[] {
  const rangeStart = startOfDay(start)
  const rangeEnd = startOfDay(end)
  return items.filter((item) => {
    const day = startOfDay(parseISO(item.startsAt))
    return day >= rangeStart && day <= rangeEnd
  })
}

function getSourceDay(context: CalendarSeriesViewContext): Date {
  if (context.activeView === 'timeGridDay') {
    return startOfDay(context.visibleRange.start)
  }
  return startOfDay(context.calendarDate)
}

function getWeekDayBounds(context: CalendarSeriesViewContext): { start: Date; end: Date } {
  if (context.activeView === 'timeGridWeek') {
    const start = startOfDay(context.visibleRange.start)
    const exclusiveEnd = startOfDay(context.visibleRange.end)
    const end =
      exclusiveEnd.getTime() > start.getTime() ? addDays(exclusiveEnd, -1) : start
    return { start, end }
  }

  const days = getVisibleWeekDays(context, context.calendarDate.toISOString())
  return { start: days[0], end: days[days.length - 1] }
}

export function buildScheduleCopyTargets(
  items: CalendarItem[],
  copy: ScheduleCopyAction,
  context: CalendarSeriesViewContext,
): ScheduleCopyTarget[] {
  const targets: ScheduleCopyTarget[] = []

  if (copy.scope === 'day') {
    const sourceDay = getSourceDay(context)
    const sourceItems = itemsOnDay(items, sourceDay)

    if (copy.mode === 'next-day') {
      const nextDay = addDays(sourceDay, 1)
      if (isSunday(nextDay)) return []

      for (const item of sourceItems) {
        const shifted = shiftIsoRange(item.startsAt, item.endsAt, 1)
        targets.push({ sourceItem: item, ...shifted })
      }
      return targets
    }

    const days =
      copy.mode === 'week'
        ? getVisibleWeekDays(context, sourceDay.toISOString())
        : getVisibleMonthDays(context.calendarDate)

    for (const item of sourceItems) {
      for (const day of days) {
        if (isSameDay(day, sourceDay) || isSunday(day)) continue
        const offset = differenceInCalendarDays(day, sourceDay)
        const shifted = shiftIsoRange(item.startsAt, item.endsAt, offset)
        targets.push({ sourceItem: item, ...shifted })
      }
    }
    return targets
  }

  if (copy.scope === 'week') {
    const { start, end } = getWeekDayBounds(context)
    const sourceItems = itemsInInclusiveRange(items, start, end)

    if (copy.mode === 'next-week') {
      for (const item of sourceItems) {
        const targetDay = addDays(startOfDay(parseISO(item.startsAt)), 7)
        if (isSunday(targetDay)) continue
        const shifted = shiftIsoRange(item.startsAt, item.endsAt, 7)
        targets.push({ sourceItem: item, ...shifted })
      }
      return targets
    }

    const monthDays = getVisibleMonthDays(context.calendarDate)
    for (const item of sourceItems) {
      const sourceDay = startOfDay(parseISO(item.startsAt))
      const sourceWeekday = getDay(sourceDay)

      for (const day of monthDays) {
        if (getDay(day) !== sourceWeekday || isSunday(day) || isSameDay(day, sourceDay)) continue
        const offset = differenceInCalendarDays(day, sourceDay)
        const shifted = shiftIsoRange(item.startsAt, item.endsAt, offset)
        targets.push({ sourceItem: item, ...shifted })
      }
    }
    return targets
  }

  const monthStart = startOfMonth(context.calendarDate)
  const monthEnd = endOfMonth(context.calendarDate)
  const sourceItems = itemsInInclusiveRange(items, monthStart, monthEnd)

  for (const item of sourceItems) {
    const shiftedStart = addMonths(parseISO(item.startsAt), 1)
    if (isSunday(startOfDay(shiftedStart))) continue
    const shiftedEnd = addMonths(parseISO(item.endsAt), 1)
    targets.push({
      sourceItem: item,
      startsAt: shiftedStart.toISOString(),
      endsAt: shiftedEnd.toISOString(),
    })
  }

  return targets
}

export function getScheduleClearItemIds(
  items: CalendarItem[],
  scope: ScheduleClearScope,
  context: CalendarSeriesViewContext,
): string[] {
  if (scope === 'day') {
    return itemsOnDay(items, getSourceDay(context)).map((item) => item.id)
  }

  if (scope === 'week') {
    const { start, end } = getWeekDayBounds(context)
    return itemsInInclusiveRange(items, start, end).map((item) => item.id)
  }

  const monthStart = startOfMonth(context.calendarDate)
  const monthEnd = endOfMonth(context.calendarDate)
  return itemsInInclusiveRange(items, monthStart, monthEnd).map((item) => item.id)
}
