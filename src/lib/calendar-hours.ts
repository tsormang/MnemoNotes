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
