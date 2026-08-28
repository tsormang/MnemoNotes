import { describe, expect, it } from 'vitest'
import {
  clockToMinutes,
  formatClockLabel,
  getWeekStartKey,
  isClockTime,
  isValidWorkingDayRange,
  toSlotTime,
} from './calendar-hours'

describe('calendar-hours', () => {
  it('validates 24-hour clock times', () => {
    expect(isClockTime('07:00')).toBe(true)
    expect(isClockTime('21:00')).toBe(true)
    expect(isClockTime('24:00')).toBe(true)
    expect(isClockTime('7:00')).toBe(false)
    expect(isClockTime('25:00')).toBe(false)
  })

  it('requires working day end after start', () => {
    expect(isValidWorkingDayRange('07:00', '21:00')).toBe(true)
    expect(isValidWorkingDayRange('21:00', '07:00')).toBe(false)
    expect(isValidWorkingDayRange('07:00', '07:00')).toBe(false)
  })

  it('formats FullCalendar slot times', () => {
    expect(toSlotTime('07:00')).toBe('07:00:00')
    expect(toSlotTime('24:00')).toBe('24:00:00')
    expect(formatClockLabel('8:05')).toBe('08:05')
    expect(clockToMinutes('21:00')).toBe(21 * 60)
  })

  it('uses Monday week keys', () => {
    // Wednesday 2026-08-26 → week of Monday 2026-08-24
    expect(getWeekStartKey(new Date(2026, 7, 26))).toBe('2026-08-24')
  })
})
