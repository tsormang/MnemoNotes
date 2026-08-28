import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import type { StatsDateRange } from './aggregate'

export type StatsRangePreset = 'week' | 'month' | 'last30' | 'custom'

export function resolveStatsRange(preset: StatsRangePreset, customStart?: string, customEnd?: string): StatsDateRange {
  const now = new Date()

  if (preset === 'custom' && customStart && customEnd) {
    const start = new Date(`${customStart}T00:00:00`)
    const end = new Date(`${customEnd}T23:59:59.999`)
    return { start, end }
  }

  if (preset === 'month') {
    return { start: startOfMonth(now), end: endOfMonth(now) }
  }

  if (preset === 'last30') {
    return { start: subDays(now, 29), end: now }
  }

  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  }
}

export function formatStatsRangeLabel(range: StatsDateRange): string {
  return `${format(range.start, 'd MMM yyyy')} – ${format(range.end, 'd MMM yyyy')}`
}
