import { addDays, format, isValid, parseISO, startOfDay } from 'date-fns'
import type { CalendarItemKind } from '../types/domain'
import { snapToHalfHour, snapToTimeStep, type TimeStepMinutes } from './calendar-hours'

/** Format an ISO timestamp for `<input type="datetime-local">`. */
export function toDatetimeLocalValue(iso: string): string {
  return format(parseIsoSafe(iso), "yyyy-MM-dd'T'HH:mm")
}

/** Parse a datetime-local value to ISO string. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

function parseIsoSafe(iso: string | null | undefined): Date {
  if (!iso) return new Date()
  const parsed = parseISO(iso)
  return isValid(parsed) ? parsed : new Date()
}

export function splitIsoDatetime(iso: string | null | undefined): { date: string; time: string } {
  const parsed = parseIsoSafe(iso)
  return {
    date: format(parsed, 'yyyy-MM-dd'),
    time: format(parsed, 'HH:mm'),
  }
}

export function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

/** Snap an ISO timestamp to the nearest 30-minute mark (local time). */
export function snapIsoToHalfHour(iso: string): string {
  const { date, time } = splitIsoDatetime(iso)
  return combineDateAndTime(date, snapToHalfHour(time))
}

/** Snap an ISO timestamp to the nearest slot for the given step (local time). */
export function snapIsoToTimeStep(iso: string, stepMinutes: TimeStepMinutes): string {
  const { date, time } = splitIsoDatetime(iso)
  return combineDateAndTime(date, snapToTimeStep(time, stepMinutes))
}

/** Whether a calendar item has fully ended. */
export function isCalendarItemPassed(
  item: { endsAt: string; allDay?: boolean; startsAt?: string; kind?: CalendarItemKind },
  now = Date.now(),
): boolean {
  return new Date(item.endsAt).getTime() <= now
}

/** Detect all-day items even when metadata.allDay was not persisted. */
export function isAllDayCalendarItem(item: {
  allDay?: boolean
  startsAt: string
  endsAt: string
  kind: CalendarItemKind
}): boolean {
  if (item.allDay) return true

  const startParts = splitIsoDatetime(item.startsAt)
  const endParts = splitIsoDatetime(item.endsAt)

  if (startParts.time !== '00:00') return false

  if (endParts.time === '00:00' && endParts.date > startParts.date) {
    return true
  }

  // Legacy mis-save: all-day note created before metadata.allDay existed.
  if (item.kind === 'note' && endParts.date === startParts.date && endParts.time === '01:00') {
    return true
  }

  return false
}

/** Repair all-day timestamps/metadata shape when loading from the database. */
export function normalizeAllDayCalendarItem<
  T extends {
    allDay?: boolean
    startsAt: string
    endsAt: string
    kind: CalendarItemKind
  },
>(item: T): T {
  if (!isAllDayCalendarItem(item)) return item

  const range =
    item.kind === 'task' && splitIsoDatetime(item.endsAt).date > splitIsoDatetime(item.startsAt).date
      ? {
          startsAt: combineDateAndTime(splitIsoDatetime(item.startsAt).date, '00:00'),
          endsAt: item.endsAt,
        }
      : allDayEventRangeFromIso(item.startsAt)

  return {
    ...item,
    allDay: true,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
  }
}

/** Snap selection range and ensure end is strictly after start. */
export function normalizeEventRange(
  startsAt: string,
  endsAt: string,
  stepMinutes: TimeStepMinutes = 30,
): { startsAt: string; endsAt: string } {
  let start = snapIsoToTimeStep(startsAt, stepMinutes)
  let end = snapIsoToTimeStep(endsAt, stepMinutes)

  if (new Date(end).getTime() <= new Date(start).getTime()) {
    end = defaultEventEnd(start)
    end = snapIsoToTimeStep(end, stepMinutes)
  }

  return { startsAt: start, endsAt: end }
}

/** Display timestamp as `dd/MM/yyyy HH:mm` (24-hour). */
export function formatDateTime24(iso: string | Date): string {
  const parsed = typeof iso === 'string' ? parseIsoSafe(iso) : iso
  return format(parsed, 'dd/MM/yyyy HH:mm')
}

/** Display time as `HH:mm` (24-hour). */
export function formatTime24(iso: string | Date): string {
  const parsed = typeof iso === 'string' ? parseIsoSafe(iso) : iso
  return format(parsed, 'HH:mm')
}

/** Default one-hour slot ending at `start`. */
export function defaultEventEnd(startIso: string): string {
  const start = parseIsoSafe(startIso)
  start.setHours(start.getHours() + 1)
  return start.toISOString()
}

/** Notes always use a fixed one-hour duration from the start time. */
export const noteEventEnd = defaultEventEnd

/** Build an exclusive end-at-midnight range for a single all-day calendar date. */
export function allDayEventRange(date: Date | string): { startsAt: string; endsAt: string } {
  const day = typeof date === 'string' ? startOfDay(parseIsoSafe(date)) : startOfDay(date)
  return {
    startsAt: day.toISOString(),
    endsAt: addDays(day, 1).toISOString(),
  }
}

/** Normalize an ISO timestamp to the all-day range for its local calendar date. */
export function allDayEventRangeFromIso(iso: string): { startsAt: string; endsAt: string } {
  const { date } = splitIsoDatetime(iso)
  return allDayEventRange(`${date}T00:00:00`)
}

/** Build an all-day range from inclusive local start/end calendar dates. */
export function allDayRangeFromDates(
  startDate: string,
  endDateInclusive: string,
): { startsAt: string; endsAt: string } {
  const startsAt = combineDateAndTime(startDate, '00:00')
  const normalizedEndDate = endDateInclusive < startDate ? startDate : endDateInclusive
  const endsAt = addDays(startOfDay(parseIsoSafe(`${normalizedEndDate}T00:00:00`)), 1).toISOString()
  return { startsAt, endsAt }
}

/** Inclusive local calendar date for an all-day event's exclusive end timestamp. */
export function allDayInclusiveEndDate(endsAt: string): string {
  return format(addDays(parseIsoSafe(endsAt), -1), 'yyyy-MM-dd')
}
