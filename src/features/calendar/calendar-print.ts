import { addDays, addMonths, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { formatShiftStaffLabel } from '../../lib/calendar-display'
import { isAllDayCalendarItem } from '../../lib/calendar-datetime'
import type { CalendarItem, CalendarItemKind, Personnel } from '../../types/domain'

export type SchedulePrintScope = 'day' | 'week' | 'month'

export interface SchedulePrintEvent {
  timeLabel: string
  kindLabel: string
  title: string
  kind: CalendarItemKind
}

export interface SchedulePrintDay {
  dateKey: string
  heading: string
  events: SchedulePrintEvent[]
}

export interface SchedulePrintLabels {
  viewDay: string
  viewWeek: string
  viewMonth: string
  allDay: string
  emptyDay: string
  untitled: string
  unassignedShift: string
  kindShift: string
  kindNote: string
  kindTask: string
}

export interface SchedulePrintModel {
  brandName: string
  organizationName: string
  viewLabel: string
  rangeLabel: string
  emptyDay: string
  filename: string
  days: SchedulePrintDay[]
}

export interface SchedulePrintRange {
  scope: SchedulePrintScope
  start: Date
  end: Date
}

export function resolveSchedulePrintRange(scope: SchedulePrintScope, anchorDate: Date): SchedulePrintRange {
  if (scope === 'day') {
    const start = startOfDay(anchorDate)
    return { scope, start, end: addDays(start, 1) }
  }

  if (scope === 'week') {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
    return { scope, start, end: addDays(start, 7) }
  }

  const start = startOfMonth(anchorDate)
  return { scope, start, end: addMonths(start, 1) }
}

export function itemOverlapsLocalDay(item: CalendarItem, day: Date): boolean {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  return start < dayEnd && end > dayStart
}

export function eachLocalDay(start: Date, endExclusive: Date): Date[] {
  const days: Date[] = []
  let cursor = startOfDay(start)
  const limit = startOfDay(endExclusive)
  while (cursor < limit) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

function kindLabel(kind: CalendarItemKind, labels: SchedulePrintLabels): string {
  if (kind === 'shift') return labels.kindShift
  if (kind === 'note') return labels.kindNote
  return labels.kindTask
}

function viewLabel(scope: SchedulePrintScope, labels: SchedulePrintLabels): string {
  if (scope === 'day') return labels.viewDay
  if (scope === 'week') return labels.viewWeek
  return labels.viewMonth
}

function formatEventTime(item: CalendarItem, labels: SchedulePrintLabels): string {
  if (isAllDayCalendarItem(item)) return labels.allDay
  const start = format(new Date(item.startsAt), 'HH:mm')
  const end = format(new Date(item.endsAt), 'HH:mm')
  return `${start} – ${end}`
}

function eventTitle(
  item: CalendarItem,
  personnel: Personnel[],
  labels: SchedulePrintLabels,
): string {
  if (item.kind === 'shift') {
    const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
    if (assignees.length === 0) return labels.unassignedShift
    return formatShiftStaffLabel(assignees)
  }

  return item.title.trim() || labels.untitled
}

function toPrintEvent(
  item: CalendarItem,
  personnel: Personnel[],
  labels: SchedulePrintLabels,
): SchedulePrintEvent {
  return {
    timeLabel: formatEventTime(item, labels),
    kindLabel: kindLabel(item.kind, labels),
    title: eventTitle(item, personnel, labels),
    kind: item.kind,
  }
}

export function buildSchedulePrintFilename(scope: SchedulePrintScope, start: Date): string {
  if (scope === 'month') return `mnemonotes-schedule_month_${format(start, 'yyyy-MM')}.pdf`
  if (scope === 'week') return `mnemonotes-schedule_week_${format(start, 'yyyy-MM-dd')}.pdf`
  return `mnemonotes-schedule_day_${format(start, 'yyyy-MM-dd')}.pdf`
}

export function buildSchedulePrintModel(input: {
  scope: SchedulePrintScope
  anchorDate: Date
  items: CalendarItem[]
  personnel: Personnel[]
  organizationName: string
  brandName: string
  rangeLabel: string
  labels: SchedulePrintLabels
  formatDayHeading: (day: Date) => string
}): SchedulePrintModel {
  const range = resolveSchedulePrintRange(input.scope, input.anchorDate)
  const days = eachLocalDay(range.start, range.end).map((day) => {
    const events = input.items
      .filter((item) => itemOverlapsLocalDay(item, day))
      .sort((left, right) => {
        const leftAllDay = isAllDayCalendarItem(left)
        const rightAllDay = isAllDayCalendarItem(right)
        if (leftAllDay !== rightAllDay) return leftAllDay ? -1 : 1
        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      })
      .map((item) => toPrintEvent(item, input.personnel, input.labels))

    return {
      dateKey: format(day, 'yyyy-MM-dd'),
      heading: input.formatDayHeading(day),
      events,
    }
  })

  return {
    brandName: input.brandName,
    organizationName: input.organizationName,
    viewLabel: viewLabel(input.scope, input.labels),
    rangeLabel: input.rangeLabel,
    emptyDay: input.labels.emptyDay,
    filename: buildSchedulePrintFilename(input.scope, range.start),
    days,
  }
}
