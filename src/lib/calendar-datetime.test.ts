import { describe, expect, it } from 'vitest'
import {
  combineDateAndTime,
  formatDateTime24,
  formatTime24,
  normalizeEventRange,
  splitIsoDatetime,
  allDayEventRange,
  allDayRangeFromDates,
  allDayInclusiveEndDate,
  isAllDayCalendarItem,
  normalizeAllDayCalendarItem,
  isCalendarItemPassed,
} from './calendar-datetime'

describe('calendar-datetime', () => {
  it('splits and combines date/time in 24-hour format', () => {
    const iso = '2026-08-08T14:30:00.000Z'
    const parts = splitIsoDatetime(iso)

    expect(parts.time).toMatch(/^\d{2}:\d{2}$/)
    expect(combineDateAndTime(parts.date, parts.time)).toBeTruthy()
  })

  it('handles missing timestamps safely', () => {
    const parts = splitIsoDatetime(undefined)
    expect(parts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(parts.time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formats display timestamps without AM/PM', () => {
    const iso = '2026-08-08T14:30:00.000Z'
    expect(formatTime24(iso)).not.toMatch(/AM|PM/i)
    expect(formatDateTime24(iso)).not.toMatch(/AM|PM/i)
    expect(formatDateTime24(iso)).toContain(':')
  })

  it('normalizes event ranges to half-hour slots with valid end', () => {
    const { startsAt, endsAt } = normalizeEventRange(
      '2026-08-28T08:10:00.000Z',
      '2026-08-28T08:10:00.000Z',
    )
    expect(new Date(endsAt).getTime()).toBeGreaterThan(new Date(startsAt).getTime())
  })

  it('builds single-day all-day ranges with exclusive end', () => {
    const { startsAt, endsAt } = allDayEventRange('2026-09-02T14:30:00.000Z')
    expect(splitIsoDatetime(startsAt).time).toBe('00:00')
    expect(allDayInclusiveEndDate(endsAt)).toBe(splitIsoDatetime(startsAt).date)
  })

  it('builds multi-day all-day ranges from inclusive dates', () => {
    const { startsAt, endsAt } = allDayRangeFromDates('2026-09-02', '2026-09-04')
    expect(splitIsoDatetime(startsAt).date).toBe('2026-09-02')
    expect(allDayInclusiveEndDate(endsAt)).toBe('2026-09-04')
  })

  it('infers legacy all-day notes saved as midnight one-hour slots', () => {
    const legacy = {
      kind: 'note' as const,
      startsAt: combineDateAndTime('2026-09-02', '00:00'),
      endsAt: combineDateAndTime('2026-09-02', '01:00'),
    }
    expect(isAllDayCalendarItem(legacy)).toBe(true)
    const normalized = normalizeAllDayCalendarItem({ ...legacy, allDay: false })
    expect(normalized.allDay).toBe(true)
    expect(allDayInclusiveEndDate(normalized.endsAt)).toBe('2026-09-02')
    expect(isCalendarItemPassed(normalized, Date.parse('2026-09-02T12:00:00'))).toBe(false)
  })
})
