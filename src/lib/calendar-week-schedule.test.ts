import { describe, expect, it } from 'vitest'
import { splitIsoDatetime } from './calendar-datetime'
import {
  buildEmptyWeekDays,
  listWeekShiftRanges,
  resolveWeekShiftRange,
  snapOptionalClockTime,
} from './calendar-week-schedule'
import { weekScheduleSchema } from './validation'

const PERSON_ID = '11111111-1111-4111-8111-111111111111'

describe('calendar week schedule', () => {
  it('builds Monday-start empty days', () => {
    const days = buildEmptyWeekDays(new Date(2026, 8, 9))
    expect(days).toHaveLength(7)
    expect(days[0]?.date).toBe('2026-09-07')
    expect(days[6]?.date).toBe('2026-09-13')
    expect(days.every((day) => !day.startTime && !day.endTime)).toBe(true)
  })

  it('keeps end on the same date unless overnight', () => {
    const range = resolveWeekShiftRange('2026-09-07', '08:00', '16:00', false)
    expect(range).not.toBeNull()
    expect(splitIsoDatetime(range!.startsAt)).toEqual({ date: '2026-09-07', time: '08:00' })
    expect(splitIsoDatetime(range!.endsAt)).toEqual({ date: '2026-09-07', time: '16:00' })
  })

  it('moves end to the next date when overnight', () => {
    const range = resolveWeekShiftRange('2026-09-07', '22:00', '06:00', true)
    expect(range).not.toBeNull()
    expect(splitIsoDatetime(range!.startsAt)).toEqual({ date: '2026-09-07', time: '22:00' })
    expect(splitIsoDatetime(range!.endsAt)).toEqual({ date: '2026-09-08', time: '06:00' })
  })

  it('rejects same-day end at or before start', () => {
    expect(resolveWeekShiftRange('2026-09-07', '22:00', '06:00', false)).toBeNull()
    expect(resolveWeekShiftRange('2026-09-07', '08:00', '08:00', false)).toBeNull()
  })

  it('skips empty days when listing ranges', () => {
    const days = buildEmptyWeekDays(new Date(2026, 8, 7))
    days[0] = { ...days[0]!, startTime: '08:00', endTime: '16:00' }
    days[2] = { ...days[2]!, startTime: '09:00', endTime: '17:00' }

    const ranges = listWeekShiftRanges(days, false)
    expect(ranges.map((entry) => entry.date)).toEqual(['2026-09-07', '2026-09-09'])
  })

  it('leaves empty clock times empty when snapping', () => {
    expect(snapOptionalClockTime('', 30)).toBe('')
    expect(snapOptionalClockTime('08:10', 60)).toBe('08:00')
  })

  it('requires a person and at least one complete day', () => {
    const days = buildEmptyWeekDays(new Date(2026, 8, 7))
    expect(
      weekScheduleSchema.safeParse({
        assignedPersonnelId: PERSON_ID,
        overnight: false,
        days,
      }).success,
    ).toBe(false)

    days[1] = { ...days[1]!, startTime: '08:00', endTime: '16:00' }
    expect(
      weekScheduleSchema.safeParse({
        assignedPersonnelId: PERSON_ID,
        overnight: false,
        days,
      }).success,
    ).toBe(true)
  })

  it('requires overnight for times that cross midnight', () => {
    const days = buildEmptyWeekDays(new Date(2026, 8, 7))
    days[0] = { ...days[0]!, startTime: '22:00', endTime: '06:00' }

    expect(
      weekScheduleSchema.safeParse({
        assignedPersonnelId: PERSON_ID,
        overnight: false,
        days,
      }).success,
    ).toBe(false)

    expect(
      weekScheduleSchema.safeParse({
        assignedPersonnelId: PERSON_ID,
        overnight: true,
        days,
      }).success,
    ).toBe(true)
  })
})
