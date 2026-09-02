import { describe, expect, it } from 'vitest'
import {
  buildHalfHourTimeSlots,
  buildHourTimeSlots,
  buildQuarterHourTimeSlots,
  buildTimeSlots,
  clockToMinutes,
  formatClockLabel,
  getWeekStartKey,
  inferTimeStepMinutes,
  isClockTime,
  isValidWorkingDayRange,
  snapToHalfHour,
  snapToTimeStep,
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

  it('builds half-hour slots through the day', () => {
    const slots = buildHalfHourTimeSlots()
    expect(slots[0]).toBe('00:00')
    expect(slots[1]).toBe('00:30')
    expect(slots.at(-1)).toBe('23:30')
    expect(slots).toHaveLength(48)
  })

  it('snaps arbitrary times to the nearest half hour', () => {
    expect(snapToHalfHour('08:10')).toBe('08:00')
    expect(snapToHalfHour('08:20')).toBe('08:30')
    expect(snapToHalfHour('23:50')).toBe('23:30')
  })

  it('builds hour and quarter-hour slots', () => {
    expect(buildHourTimeSlots()).toHaveLength(24)
    expect(buildHourTimeSlots()[8]).toBe('08:00')
    expect(buildQuarterHourTimeSlots()).toHaveLength(96)
    expect(buildQuarterHourTimeSlots()[7]).toBe('01:45')
    expect(buildTimeSlots(15)[0]).toBe('00:00')
  })

  it('snaps to configurable steps and infers the coarsest matching step', () => {
    expect(snapToTimeStep('08:10', 60)).toBe('08:00')
    expect(snapToTimeStep('08:40', 30)).toBe('08:30')
    expect(snapToTimeStep('08:22', 15)).toBe('08:15')
    expect(inferTimeStepMinutes('09:00')).toBe(60)
    expect(inferTimeStepMinutes('09:30')).toBe(30)
    expect(inferTimeStepMinutes('09:15')).toBe(15)
  })
})
