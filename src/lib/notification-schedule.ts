import type { CalendarItemKind, NotificationDefaults, NotificationTrigger } from '../types/domain'
import i18n from '../i18n'

export interface NotificationRuleTiming {
  triggerKind: NotificationTrigger
  offsetMinutes: number
}

export const NOTIFICATION_OFFSET_PRESETS = [-60, -30, -15, 0] as const

export const ORG_NOTIFICATION_DEFAULTS: NotificationDefaults = {
  shift: [-30, 0],
  ackRequired: [-15, 0],
  note: [],
  task: [],
}

/** Map stored minute offsets (relative to event start) to rule trigger + magnitude. */
export function offsetToRuleTiming(offsetMinutes: number): NotificationRuleTiming {
  if (offsetMinutes < 0) {
    return { triggerKind: 'before_start', offsetMinutes: Math.abs(offsetMinutes) }
  }
  if (offsetMinutes === 0) {
    return { triggerKind: 'at_start', offsetMinutes: 0 }
  }
  return { triggerKind: 'during', offsetMinutes: offsetMinutes }
}

export function computeScheduledFor(
  startsAt: string,
  endsAt: string,
  triggerKind: NotificationTrigger,
  offsetMinutes: number,
): Date {
  const start = new Date(startsAt)
  const end = new Date(endsAt)

  switch (triggerKind) {
    case 'before_start':
      return new Date(start.getTime() - offsetMinutes * 60_000)
    case 'at_start':
      return start
    case 'during':
      return new Date(start.getTime() + offsetMinutes * 60_000)
    case 'before_end':
      return new Date(end.getTime() - offsetMinutes * 60_000)
    case 'after_end':
      return new Date(end.getTime() + offsetMinutes * 60_000)
    default:
      return start
  }
}

export function normalizeNotificationOffsets(offsets: number[]): number[] {
  return [...new Set(offsets)].sort((a, b) => a - b)
}

export function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes < 0) {
    const minutes = Math.abs(offsetMinutes)
    if (minutes % 60 === 0 && minutes >= 60) {
      const hours = minutes / 60
      return i18n.t('settings:reminders.offset.hoursBefore', { count: hours })
    }
    return i18n.t('settings:reminders.offset.minutesBefore', { count: minutes })
  }
  if (offsetMinutes === 0) {
    return i18n.t('settings:reminders.offset.onTime')
  }
  return i18n.t('settings:reminders.offset.minutesAfter', { count: offsetMinutes })
}

export function offsetsEqual(left: number[], right: number[]): boolean {
  const a = normalizeNotificationOffsets(left)
  const b = normalizeNotificationOffsets(right)
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function parseNotificationDefaults(value: unknown): NotificationDefaults {
  if (!value || typeof value !== 'object') {
    return { ...ORG_NOTIFICATION_DEFAULTS }
  }

  const record = value as Record<string, unknown>
  const readOffsets = (key: keyof NotificationDefaults): number[] => {
    const raw = record[key]
    if (!Array.isArray(raw)) return [...ORG_NOTIFICATION_DEFAULTS[key]]
    return normalizeNotificationOffsets(raw.map(Number).filter((n) => Number.isFinite(n)))
  }

  return {
    shift: readOffsets('shift'),
    ackRequired: readOffsets('ackRequired'),
    note: readOffsets('note'),
    task: readOffsets('task'),
  }
}

export function resolveNotificationOffsets(input: {
  kind: CalendarItemKind
  requiresAcknowledgement: boolean
  customOffsets?: number[] | null
  useCustomNotificationOffsets?: boolean
  orgDefaults?: NotificationDefaults | null
}): number[] {
  if (input.useCustomNotificationOffsets && input.customOffsets) {
    return normalizeNotificationOffsets(input.customOffsets)
  }

  const defaults = input.orgDefaults ?? ORG_NOTIFICATION_DEFAULTS

  if (input.requiresAcknowledgement) {
    return [...defaults.ackRequired]
  }

  return [...defaults[input.kind]]
}

/** Default reminder offsets (minutes from start) by calendar item shape. */
export function defaultNotificationOffsets(input: {
  kind: CalendarItemKind
  requiresAcknowledgement: boolean
  orgDefaults?: NotificationDefaults | null
}): number[] {
  return resolveNotificationOffsets({
    kind: input.kind,
    requiresAcknowledgement: input.requiresAcknowledgement,
    orgDefaults: input.orgDefaults,
  })
}
