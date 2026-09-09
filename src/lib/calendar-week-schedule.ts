import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { combineDateAndTime } from './calendar-datetime'
import { isClockTime, snapToTimeStep, type TimeStepMinutes } from './calendar-hours'

export interface WeekScheduleDayInput {
  date: string
  startTime: string
  endTime: string
}

export function buildEmptyWeekDays(weekAnchor: Date): WeekScheduleDayInput[] {
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, index) => ({
    date: format(addDays(weekStart, index), 'yyyy-MM-dd'),
    startTime: '',
    endTime: '',
  }))
}

export function addCalendarDate(date: string, days: number): string {
  return format(addDays(parseISO(`${date}T12:00:00`), days), 'yyyy-MM-dd')
}

export function isCompleteWeekDay(day: WeekScheduleDayInput): boolean {
  return Boolean(day.startTime) && Boolean(day.endTime)
}

export function isPartialWeekDay(day: WeekScheduleDayInput): boolean {
  return Boolean(day.startTime) !== Boolean(day.endTime)
}

export function snapOptionalClockTime(value: string, stepMinutes: TimeStepMinutes): string {
  if (!value) return ''
  return snapToTimeStep(value, stepMinutes)
}

export function resolveWeekShiftRange(
  date: string,
  startTime: string,
  endTime: string,
  overnight: boolean,
): { startsAt: string; endsAt: string } | null {
  if (!isClockTime(startTime) || !isClockTime(endTime) || startTime === '24:00' || endTime === '24:00') {
    return null
  }

  const startsAt = combineDateAndTime(date, startTime)
  const endDate = overnight ? addCalendarDate(date, 1) : date
  const endsAt = combineDateAndTime(endDate, endTime)
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return null
  }

  return { startsAt, endsAt }
}

export function listWeekShiftRanges(
  days: WeekScheduleDayInput[],
  overnight: boolean,
): Array<{ date: string; startsAt: string; endsAt: string }> {
  const ranges: Array<{ date: string; startsAt: string; endsAt: string }> = []
  for (const day of days) {
    if (!isCompleteWeekDay(day)) continue
    const range = resolveWeekShiftRange(day.date, day.startTime, day.endTime, overnight)
    if (!range) continue
    ranges.push({ date: day.date, ...range })
  }
  return ranges
}
