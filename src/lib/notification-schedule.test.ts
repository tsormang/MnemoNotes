import { describe, expect, it } from 'vitest'
import {
  computeScheduledFor,
  defaultNotificationOffsets,
  formatOffsetLabel,
  normalizeNotificationOffsets,
  offsetToRuleTiming,
  offsetsEqual,
  ORG_NOTIFICATION_DEFAULTS,
  resolveNotificationOffsets,
  resolveAllDayNotificationOffsets,
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

describe('formatOffsetLabel', () => {
  it('formats before-start offsets', () => {
    expect(formatOffsetLabel(-30)).toBe('30 minutes before start')
    expect(formatOffsetLabel(-60)).toBe('1 hour before start')
  })

  it('formats on-time', () => {
    expect(formatOffsetLabel(0)).toBe('On time')
  })
})

describe('normalizeNotificationOffsets', () => {
  it('dedupes and sorts', () => {
    expect(normalizeNotificationOffsets([0, -30, -30, -15])).toEqual([-30, -15, 0])
  })
})

describe('offsetsEqual', () => {
  it('compares normalized offsets', () => {
    expect(offsetsEqual([-30, 0], [0, -30])).toBe(true)
    expect(offsetsEqual([-30, 0], [-15, 0])).toBe(false)
  })
})

describe('resolveAllDayNotificationOffsets', () => {
  it('returns only on-time when configured for the event kind', () => {
    expect(
      resolveAllDayNotificationOffsets({
        kind: 'note',
        requiresAcknowledgement: false,
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, note: [-15, 0] },
      }),
    ).toEqual([0])
  })

  it('ignores before-start presets for all-day events', () => {
    expect(
      resolveAllDayNotificationOffsets({
        kind: 'note',
        requiresAcknowledgement: false,
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, note: [-30, -15] },
      }),
    ).toEqual([])
  })

  it('uses acknowledgement defaults when required', () => {
    expect(
      resolveAllDayNotificationOffsets({
        kind: 'task',
        requiresAcknowledgement: true,
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, ackRequired: [-60, 0] },
      }),
    ).toEqual([0])
  })
})

describe('resolveNotificationOffsets', () => {
  it('ignores custom offsets for all-day events', () => {
    expect(
      resolveNotificationOffsets({
        kind: 'note',
        requiresAcknowledgement: false,
        allDay: true,
        useCustomNotificationOffsets: true,
        customOffsets: [-60, -30, -15],
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, note: [0] },
      }),
    ).toEqual([0])
  })
})

describe('resolveNotificationOffsets (timed)', () => {
  it('uses custom offsets when enabled', () => {
    expect(
      resolveNotificationOffsets({
        kind: 'shift',
        requiresAcknowledgement: false,
        useCustomNotificationOffsets: true,
        customOffsets: [-60, -15, 0],
      }),
    ).toEqual([-60, -15, 0])
  })

  it('uses org ack defaults', () => {
    expect(
      resolveNotificationOffsets({
        kind: 'note',
        requiresAcknowledgement: true,
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, ackRequired: [-60, 0] },
      }),
    ).toEqual([-60, 0])
  })

  it('uses org kind defaults', () => {
    expect(
      resolveNotificationOffsets({
        kind: 'shift',
        requiresAcknowledgement: false,
        orgDefaults: { ...ORG_NOTIFICATION_DEFAULTS, shift: [-60, -30, 0] },
      }),
    ).toEqual([-60, -30, 0])
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
