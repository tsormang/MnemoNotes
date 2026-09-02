import { format, isValid, parseISO } from 'date-fns'
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
export function isCalendarItemPassed(item: { endsAt: string }, now = Date.now()): boolean {
  return new Date(item.endsAt).getTime() <= now
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
