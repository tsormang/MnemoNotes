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

export type TimeStepMinutes = 60 | 30 | 15

const HOUR_MINUTES = 60
const HALF_HOUR_MINUTES = 30
const QUARTER_HOUR_MINUTES = 15

function buildTimeSlotsForStep(
  stepMinutes: number,
  options?: { includeEndOfDay?: boolean },
): ClockTime[] {
  const slots: ClockTime[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`)
  }
  if (options?.includeEndOfDay) {
    slots.push('24:00')
  }
  return slots
}

/** 24-hour times on the hour: 00:00, 01:00, … 23:00. */
export function buildHourTimeSlots(options?: { includeEndOfDay?: boolean }): ClockTime[] {
  return buildTimeSlotsForStep(HOUR_MINUTES, options)
}

/** 24-hour times every 30 minutes: 00:00, 00:30, … 23:30. */
export function buildHalfHourTimeSlots(options?: { includeEndOfDay?: boolean }): ClockTime[] {
  return buildTimeSlotsForStep(HALF_HOUR_MINUTES, options)
}

/** 24-hour times every 15 minutes: 00:00, 00:15, … 23:45. */
export function buildQuarterHourTimeSlots(options?: { includeEndOfDay?: boolean }): ClockTime[] {
  return buildTimeSlotsForStep(QUARTER_HOUR_MINUTES, options)
}

export function buildTimeSlots(
  stepMinutes: TimeStepMinutes,
  options?: { includeEndOfDay?: boolean },
): ClockTime[] {
  switch (stepMinutes) {
    case 60:
      return buildHourTimeSlots(options)
    case 30:
      return buildHalfHourTimeSlots(options)
    case 15:
      return buildQuarterHourTimeSlots(options)
  }
}

function maxMinutesForStep(stepMinutes: TimeStepMinutes): number {
  if (stepMinutes === 60) return 23 * 60
  if (stepMinutes === 30) return 23 * 60 + 30
  return 23 * 60 + 45
}

/** Snap a clock time to the nearest slot for the given step (stays within the same day). */
export function snapToTimeStep(value: string, stepMinutes: TimeStepMinutes): ClockTime {
  if (value === '24:00') return '24:00'
  if (!isClockTime(value)) return '00:00'

  const snapped = Math.round(clockToMinutes(value) / stepMinutes) * stepMinutes
  const clamped = Math.min(snapped, maxMinutesForStep(stepMinutes))
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/** Snap a clock time to the nearest 30-minute slot (stays within the same day). */
export function snapToHalfHour(value: string): ClockTime {
  return snapToTimeStep(value, 30)
}

/** Pick the coarsest step that preserves an existing clock time. */
export function inferTimeStepMinutes(value: string): TimeStepMinutes {
  if (value === '24:00') return 60
  if (!isClockTime(value)) return 60

  const remainder = clockToMinutes(value) % 60
  if (remainder === 0) return 60
  if (remainder % 30 === 0) return 30
  return 15
}
