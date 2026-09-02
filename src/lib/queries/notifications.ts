import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarItems as demoCalendarItems } from '../../data/demo'
import { isCalendarItemPassed } from '../calendar-datetime'
import { invokeEdgeFunction } from '../edge-functions'
import { computeScheduledFor } from '../notification-schedule'
import { isSupabaseConfigured, supabase } from '../supabase'
import type { CalendarItem, NotificationTrigger } from '../../types/domain'

export interface InAppNotification {
  id: string
  organizationId: string
  calendarItemId: string
  title: string
  kind: string
  requiresAcknowledgement: boolean
  scheduledFor: string
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'acknowledged' | 'expired'
  triggerKind: NotificationTrigger
  offsetMinutes: number
  inAppSurfacedAt?: string
}

export interface PendingAcknowledgement {
  calendarItemId: string
  title: string
  kind: CalendarItem['kind']
  startsAt: string
  endsAt: string
  requiresAcknowledgement: boolean
}

export function useInAppNotifications(
  organizationId: string | null,
  userId: string | null,
  refetchInterval = 60_000,
) {
  return useQuery({
    queryKey: ['notifications', organizationId, userId],
    queryFn: async (): Promise<InAppNotification[]> => {
      if (!organizationId || !userId || !supabase) return []

      const { data, error } = await supabase
        .from('notification_jobs')
        .select(
          'id, organization_id, scheduled_for, status, payload, notification_rules(trigger_kind)',
        )
        .eq('organization_id', organizationId)
        .eq('recipient_user_id', userId)
        .in('status', ACTIVE_NOTIFICATION_STATUSES)
        .order('scheduled_for', { ascending: true })
        .limit(50)

      if (error) throw error

      return (data ?? []).map((row) => {
        const payload = (row.payload ?? {}) as Record<string, unknown>
        const ruleData = row.notification_rules as
          | { trigger_kind: NotificationTrigger }
          | { trigger_kind: NotificationTrigger }[]
          | null
        const rule = Array.isArray(ruleData) ? ruleData[0] : ruleData

        return {
          id: row.id,
          organizationId: row.organization_id,
          calendarItemId: String(payload.calendarItemId ?? ''),
          title: String(payload.title ?? 'Calendar item'),
          kind: String(payload.kind ?? 'note'),
          requiresAcknowledgement: Boolean(payload.requiresAcknowledgement),
          scheduledFor: row.scheduled_for,
          status: row.status as InAppNotification['status'],
          triggerKind: rule?.trigger_kind ?? 'at_start',
          offsetMinutes: Number(payload.offsetMinutes ?? 0),
          inAppSurfacedAt:
            typeof payload.inAppSurfacedAt === 'string' ? payload.inAppSurfacedAt : undefined,
        }
      })
    },
    enabled: Boolean(organizationId && userId && isSupabaseConfigured),
    refetchInterval,
  })
}

export function usePendingAcknowledgements(
  organizationId: string | null,
  userId: string | null,
  calendarItems: CalendarItem[],
) {
  const ackScopeKey = calendarItems
    .filter((item) => item.requiresAcknowledgement)
    .map((item) => item.id)
    .sort()
    .join(',')

  return useQuery({
    queryKey: ['pending-acks', organizationId, userId, ackScopeKey],
    queryFn: async (): Promise<PendingAcknowledgement[]> => {
      if (!organizationId || !userId || !supabase) {
        return calendarItems
          .filter((item) => item.requiresAcknowledgement && !isCalendarItemPassed(item))
          .map((item) => ({
            calendarItemId: item.id,
            title: item.title,
            kind: item.kind,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            requiresAcknowledgement: item.requiresAcknowledgement,
          }))
      }

      const { data: acks, error: ackError } = await supabase
        .from('calendar_item_acknowledgements')
        .select('calendar_item_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)

      if (ackError) throw ackError

      const acknowledged = new Set((acks ?? []).map((row) => row.calendar_item_id))

      return calendarItems
        .filter((item) => item.requiresAcknowledgement && !acknowledged.has(item.id) && !isCalendarItemPassed(item))
        .map((item) => ({
          calendarItemId: item.id,
          title: item.title,
          kind: item.kind,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          requiresAcknowledgement: item.requiresAcknowledgement,
        }))
    },
    enabled: Boolean(organizationId && userId && isSupabaseConfigured),
  })
}

export function useMarkNotificationsSurfaced(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobIds: string[]) => {
      await markNotificationJobsSurfaced(organizationId, userId, jobIds)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', organizationId, userId] })
    },
  })
}

async function markNotificationJobsSurfaced(
  organizationId: string | null,
  userId: string | null,
  jobIds: string[],
) {
  if (!organizationId || !userId || !supabase || jobIds.length === 0) return

  const client = supabase
  const surfacedAt = new Date().toISOString()

  const { data: rows, error: readError } = await client
    .from('notification_jobs')
    .select('id, payload')
    .in('id', jobIds)
    .eq('organization_id', organizationId)
    .eq('recipient_user_id', userId)
    .eq('status', 'delivered')

  if (readError) throw readError

  const deliveredRows = rows ?? []
  if (deliveredRows.length !== jobIds.length) {
    throw new Error('One or more notification jobs are no longer deliverable.')
  }

  const updateResults = await Promise.all(
    deliveredRows.map(async (row) => {
      const payload = {
        ...((row.payload ?? {}) as Record<string, unknown>),
        inAppSurfacedAt: surfacedAt,
      }

      const { data: updated, error } = await client
        .from('notification_jobs')
        .update({ payload, updated_at: surfacedAt })
        .eq('id', row.id)
        .eq('status', 'delivered')
        .select('id')
        .maybeSingle()

      if (error) throw error
      return updated
    }),
  )

  const failedIds = deliveredRows
    .filter((_, index) => !updateResults[index])
    .map((row) => row.id)

  if (failedIds.length > 0) {
    throw new Error(`Failed to mark notification jobs as surfaced: ${failedIds.join(', ')}`)
  }
}

export function useDismissNotificationJob(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      await dismissNotificationJobs(organizationId, userId, [jobId])
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', organizationId, userId] })
    },
  })
}

export function useDismissNotificationJobs(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobIds: string[]) => {
      await dismissNotificationJobs(organizationId, userId, jobIds)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', organizationId, userId] })
    },
  })
}

async function dismissNotificationJobs(
  organizationId: string | null,
  userId: string | null,
  jobIds: string[],
) {
  if (!organizationId || !userId || !supabase) {
    throw new Error('Organization is not available.')
  }

  if (jobIds.length === 0) return

  const { error } = await supabase
    .from('notification_jobs')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .in('id', jobIds)
    .eq('organization_id', organizationId)
    .eq('recipient_user_id', userId)

  if (error) throw error
}

export function useExpireStaleNotificationJobs(
  organizationId: string | null,
  userId: string | null,
  calendarItems: CalendarItem[],
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notifications: InAppNotification[]) => {
      if (!organizationId || !userId || !supabase || notifications.length === 0) return

      const staleIds = notifications
        .filter((notification) => {
          const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
          return item && isCalendarItemPassed(item)
        })
        .map((notification) => notification.id)

      if (staleIds.length === 0) return

      const { error } = await supabase
        .from('notification_jobs')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .in('id', staleIds)
        .eq('organization_id', organizationId)
        .eq('recipient_user_id', userId)
        .in('status', ACTIVE_NOTIFICATION_STATUSES)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', organizationId, userId] })
    },
  })
}

export function useAcknowledgeCalendarItem(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (calendarItemId: string) => {
      if (!organizationId || !userId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error: ackError } = await supabase.from('calendar_item_acknowledgements').insert({
        organization_id: organizationId,
        calendar_item_id: calendarItemId,
        user_id: userId,
      })

      if (ackError) throw ackError

      const { error: jobError } = await supabase
        .from('notification_jobs')
        .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('recipient_user_id', userId)
        .filter('payload->>calendarItemId', 'eq', calendarItemId)

      if (jobError) throw jobError
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-acks', organizationId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', organizationId, userId] }),
      ])
    },
  })
}

export function useRefreshNotifications() {
  return useMutation({
    mutationFn: async () => {
      await invokeEdgeFunction<{ ok: boolean }>('schedule-notifications', {})
    },
  })
}

export function formatNotificationTiming(
  scheduledFor: string,
  triggerKind: NotificationTrigger,
  offsetMinutes: number,
): string {
  const when = new Date(scheduledFor)
  const clock = when.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  switch (triggerKind) {
    case 'before_start':
      return `${clock} (${offsetMinutes}m before start)`
    case 'at_start':
      return `${clock} (at start)`
    case 'during':
      return `${clock} (${offsetMinutes}m after start)`
    case 'before_end':
      return `${clock} (${offsetMinutes}m before end)`
    case 'after_end':
      return `${clock} (${offsetMinutes}m after end)`
    default:
      return clock
  }
}

export const ACTIVE_NOTIFICATION_STATUSES: InAppNotification['status'][] = [
  'queued',
  'sent',
  'delivered',
]

export function isNotificationDue(scheduledFor: string): boolean {
  return new Date(scheduledFor).getTime() <= Date.now()
}

/** Jobs that should appear in the panel badge and "due now" list. */
export function isActiveDueNotification(
  notification: InAppNotification,
  calendarItems: CalendarItem[] = [],
): boolean {
  if (!ACTIVE_NOTIFICATION_STATUSES.includes(notification.status)) return false
  if (!isNotificationDue(notification.scheduledFor)) return false

  const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
  if (item && isCalendarItemPassed(item)) return false

  return true
}

/** Jobs that should auto-popup (not yet surfaced this session cycle). */
export function shouldPopupNotification(
  notification: InAppNotification,
  calendarItems: CalendarItem[] = [],
): boolean {
  return (
    notification.status === 'delivered' &&
    !notification.inAppSurfacedAt &&
    isNotificationDue(notification.scheduledFor) &&
    isActiveDueNotification(notification, calendarItems)
  )
}

/** Skip notifications already surfaced as toasts or desktop popups. */
export function markAndFilterNewDueNotifications(
  dueNotifications: InAppNotification[],
  shownIds: Set<string>,
): InAppNotification[] {
  const fresh: InAppNotification[] = []

  for (const notification of dueNotifications) {
    if (shownIds.has(notification.id)) continue
    shownIds.add(notification.id)
    fresh.push(notification)
  }

  return fresh
}

export function getDemoPendingAcknowledgements(
  calendarItems: CalendarItem[],
): PendingAcknowledgement[] {
  return calendarItems
    .filter((item) => item.requiresAcknowledgement && !isCalendarItemPassed(item))
    .map((item) => ({
      calendarItemId: item.id,
      title: item.title,
      kind: item.kind,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      requiresAcknowledgement: item.requiresAcknowledgement,
    }))
}

/** Demo fallback when Supabase is not configured. */
export function getDemoNotifications(): InAppNotification[] {
  return demoCalendarItems.flatMap((item) =>
    item.notificationOffsets.map((offset, offsetIndex) => {
      const scheduledFor = computeScheduledFor(
        item.startsAt,
        item.endsAt,
        offset < 0 ? 'before_start' : offset === 0 ? 'at_start' : 'during',
        Math.abs(offset),
      )

      return {
        id: `demo-${item.id}-${offsetIndex}`,
        organizationId: 'demo',
        calendarItemId: item.id,
        title: item.title,
        kind: item.kind,
        requiresAcknowledgement: item.requiresAcknowledgement,
        scheduledFor: scheduledFor.toISOString(),
        status: 'delivered' as const,
        triggerKind: offset < 0 ? 'before_start' : offset === 0 ? 'at_start' : 'during',
        offsetMinutes: Math.abs(offset),
      }
    }),
  )
}
