import { format, startOfWeek } from 'date-fns'

/** Clock time as `HH:mm` (24-hour). */
export type ClockTime = string

export const DEFAULT_WORKING_DAY_START = '07:00'
export const DEFAULT_WORKING_DAY_END = '21:00'
export const FULL_DAY_START = '00:00'
export const FULL_DAY_END = '24:00'

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const END_OF_DAY_PATTERN = /^24:00$/

export function isClockTime(value: string): value is ClockTime {
  return CLOCK_TIME_PATTERN.test(value) || END_OF_DAY_PATTERN.test(value)
}

export function toSlotTime(value: string): string {
  if (value === '24:00') return '24:00:00'
  const [hours, minutes] = value.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`
}

export function formatClockLabel(value: string): string {
  if (value === '24:00') return '24:00'
  const [hours, minutes] = value.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export function clockToMinutes(value: string): number {
  if (value === '24:00') return 24 * 60
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function isValidWorkingDayRange(start: string, end: string): boolean {
  if (!isClockTime(start) || !isClockTime(end)) return false
  if (start === '24:00') return false
  return clockToMinutes(start) < clockToMinutes(end)
}

/** Monday-based week key used for night-shift overrides. */
export function getWeekStartKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

const HALF_HOUR_MINUTES = 30

/** 24-hour times every 30 minutes: 00:00, 00:30, … 23:30. */
export function buildHalfHourTimeSlots(options?: { includeEndOfDay?: boolean }): ClockTime[] {
  const slots: ClockTime[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += HALF_HOUR_MINUTES) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`)
  }
  if (options?.includeEndOfDay) {
    slots.push('24:00')
  }
  return slots
}

/** Snap a clock time to the nearest 30-minute slot (stays within the same day). */
export function snapToHalfHour(value: string): ClockTime {
  if (value === '24:00') return '24:00'
  if (!isClockTime(value)) return '00:00'

  const snapped = Math.round(clockToMinutes(value) / HALF_HOUR_MINUTES) * HALF_HOUR_MINUTES
  const clamped = Math.min(snapped, 23 * 60 + 30)
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
