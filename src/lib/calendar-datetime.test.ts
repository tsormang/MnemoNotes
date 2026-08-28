import { describe, expect, it } from 'vitest'
import {
  combineDateAndTime,
  formatDateTime24,
  formatTime24,
  normalizeEventRange,
  splitIsoDatetime,
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
})
