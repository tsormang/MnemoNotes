import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { describe, expect, it, vi } from 'vitest'
import { resolveStatsRange } from './range'

describe('resolveStatsRange', () => {
  it('returns null for custom preset until both dates are provided', () => {
    expect(resolveStatsRange('custom')).toBeNull()
    expect(resolveStatsRange('custom', '', '')).toBeNull()
    expect(resolveStatsRange('custom', '2026-08-01', '')).toBeNull()
    expect(resolveStatsRange('custom', '', '2026-08-31')).toBeNull()
  })

  it('returns the selected custom range when both dates are provided', () => {
    const range = resolveStatsRange('custom', '2026-08-01', '2026-08-15')

    expect(range).not.toBeNull()
    expect(range?.start).toEqual(new Date('2026-08-01T00:00:00'))
    expect(range?.end).toEqual(new Date('2026-08-15T23:59:59.999'))
  })

  it('returns the current week for the week preset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00'))

    const range = resolveStatsRange('week')

    expect(range).toEqual({
      start: startOfWeek(new Date('2026-08-28T12:00:00'), { weekStartsOn: 1 }),
      end: endOfWeek(new Date('2026-08-28T12:00:00'), { weekStartsOn: 1 }),
    })

    vi.useRealTimers()
  })

  it('returns the current month for the month preset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00'))

    const range = resolveStatsRange('month')

    expect(range).toEqual({
      start: startOfMonth(new Date('2026-08-28T12:00:00')),
      end: endOfMonth(new Date('2026-08-28T12:00:00')),
    })

    vi.useRealTimers()
  })
})
