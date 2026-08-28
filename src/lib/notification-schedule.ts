import type { NotificationTrigger } from '../types/domain'

export interface NotificationRuleTiming {
  triggerKind: NotificationTrigger
  offsetMinutes: number
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

/** Default reminder offsets (minutes from start) by calendar item shape. */
export function defaultNotificationOffsets(input: {
  kind: 'shift' | 'note' | 'task'
  requiresAcknowledgement: boolean
}): number[] {
  if (input.requiresAcknowledgement) {
    return [-15, 0]
  }
  if (input.kind === 'shift') {
    return [-30, 0]
  }
  return []
}
