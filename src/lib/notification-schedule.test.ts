import { describe, expect, it } from 'vitest'
import {
  computeScheduledFor,
  defaultNotificationOffsets,
  offsetToRuleTiming,
} from './notification-schedule'

describe('offsetToRuleTiming', () => {
  it('maps negative offsets to before_start', () => {
    expect(offsetToRuleTiming(-30)).toEqual({ triggerKind: 'before_start', offsetMinutes: 30 })
  })

  it('maps zero to at_start', () => {
    expect(offsetToRuleTiming(0)).toEqual({ triggerKind: 'at_start', offsetMinutes: 0 })
  })

  it('maps positive offsets to during', () => {
    expect(offsetToRuleTiming(15)).toEqual({ triggerKind: 'during', offsetMinutes: 15 })
  })
})

describe('computeScheduledFor', () => {
  const startsAt = '2026-08-28T08:00:00.000Z'
  const endsAt = '2026-08-28T14:00:00.000Z'

  it('subtracts minutes for before_start', () => {
    const result = computeScheduledFor(startsAt, endsAt, 'before_start', 30)
    expect(result.toISOString()).toBe('2026-08-28T07:30:00.000Z')
  })

  it('returns start for at_start', () => {
    const result = computeScheduledFor(startsAt, endsAt, 'at_start', 0)
    expect(result.toISOString()).toBe(startsAt)
  })
})

describe('defaultNotificationOffsets', () => {
  it('uses acknowledgement presets', () => {
    expect(defaultNotificationOffsets({ kind: 'note', requiresAcknowledgement: true })).toEqual([
      -15, 0,
    ])
  })

  it('uses shift presets', () => {
    expect(defaultNotificationOffsets({ kind: 'shift', requiresAcknowledgement: false })).toEqual([
      -30, 0,
    ])
  })
})
