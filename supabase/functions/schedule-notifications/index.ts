import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authorizeNotificationManager } from '../_shared/cron-auth.ts'
import { corsHeaders, json } from '../_shared/http.ts'

type NotificationTrigger = 'before_start' | 'at_start' | 'during' | 'before_end' | 'after_end'

interface NotificationRuleRow {
  id: string
  organization_id: string
  calendar_item_id: string
  trigger_kind: NotificationTrigger
  offset_minutes: number
  calendar_items: {
    starts_at: string
    ends_at: string
    title: string
    kind: string
    requires_acknowledgement: boolean
  }
}

function computeScheduledFor(
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

async function resolveRecipientIds(
  serviceClient: SupabaseClient,
  rule: NotificationRuleRow,
): Promise<Set<string>> {
  const item = rule.calendar_items
  const recipientIds = new Set<string>()

  if (item.kind === 'shift') {
    const { data: assignments } = await serviceClient
      .from('shift_assignments')
      .select('personnel_id, personnel:personnel_id(profile_id)')
      .eq('calendar_item_id', rule.calendar_item_id)

    for (const assignment of assignments ?? []) {
      const profileId = (assignment.personnel as { profile_id: string | null } | null)?.profile_id
      if (profileId) recipientIds.add(profileId)
    }

    return recipientIds
  }

  const { data: personnel } = await serviceClient
    .from('personnel')
    .select('profile_id')
    .eq('organization_id', rule.organization_id)
    .eq('status', 'active')
    .not('profile_id', 'is', null)

  for (const row of personnel ?? []) {
    if (row.profile_id) recipientIds.add(row.profile_id)
  }

  return recipientIds
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authError = await authorizeNotificationManager(request)
    if (authError) return authError

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase function environment variables.')
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const now = new Date()
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60_000)

    const { data: rules, error: rulesError } = await serviceClient
      .from('notification_rules')
      .select(
        'id, organization_id, calendar_item_id, trigger_kind, offset_minutes, calendar_items!inner(starts_at, ends_at, title, kind, requires_acknowledgement)',
      )
      .eq('enabled', true)
      .lte('calendar_items.starts_at', horizon.toISOString())

    if (rulesError) throw rulesError

    let created = 0
    let delivered = 0

    for (const rule of (rules ?? []) as NotificationRuleRow[]) {
      const item = rule.calendar_items
      if (new Date(item.ends_at).getTime() <= now.getTime()) continue

      const scheduledFor = computeScheduledFor(
        item.starts_at,
        item.ends_at,
        rule.trigger_kind,
        rule.offset_minutes,
      )

      if (scheduledFor > horizon) continue
      if (scheduledFor.getTime() > new Date(item.ends_at).getTime()) continue

      const recipientIds = await resolveRecipientIds(serviceClient, rule)
      if (recipientIds.size === 0) continue

      for (const recipientUserId of recipientIds) {
        const idempotencyKey = `${rule.id}:${recipientUserId}`
        const status = scheduledFor <= now ? 'delivered' : 'queued'

        const { error: insertError } = await serviceClient.from('notification_jobs').upsert(
          {
            organization_id: rule.organization_id,
            notification_rule_id: rule.id,
            recipient_user_id: recipientUserId,
            scheduled_for: scheduledFor.toISOString(),
            status,
            idempotency_key: idempotencyKey,
            payload: {
              calendarItemId: rule.calendar_item_id,
              title: item.title,
              kind: item.kind,
              requiresAcknowledgement: item.requires_acknowledgement,
              triggerKind: rule.trigger_kind,
              offsetMinutes: rule.offset_minutes,
            },
            updated_at: now.toISOString(),
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true },
        )

        if (!insertError) created += 1
      }
    }

    const { data: dueJobs, error: dueError } = await serviceClient
      .from('notification_jobs')
      .select('id, payload')
      .eq('status', 'queued')
      .lte('scheduled_for', now.toISOString())

    if (dueError) throw dueError

    const dueJobRows = dueJobs ?? []
    if (dueJobRows.length > 0) {
      const calendarItemIds = [
        ...new Set(
          dueJobRows
            .map((job) => String((job.payload as Record<string, unknown> | null)?.calendarItemId ?? ''))
            .filter(Boolean),
        ),
      ]

      const endedItemIds = new Set<string>()
      if (calendarItemIds.length > 0) {
        const { data: endedItems, error: endedError } = await serviceClient
          .from('calendar_items')
          .select('id, ends_at')
          .in('id', calendarItemIds)
          .lte('ends_at', now.toISOString())

        if (endedError) throw endedError
        for (const row of endedItems ?? []) {
          endedItemIds.add(row.id)
        }
      }

      const deliverIds: string[] = []
      const expireIds: string[] = []

      for (const job of dueJobRows) {
        const calendarItemId = String(
          (job.payload as Record<string, unknown> | null)?.calendarItemId ?? '',
        )
        if (calendarItemId && endedItemIds.has(calendarItemId)) {
          expireIds.push(job.id)
        } else {
          deliverIds.push(job.id)
        }
      }

      if (expireIds.length > 0) {
        const { error: expireError } = await serviceClient
          .from('notification_jobs')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .in('id', expireIds)
          .eq('status', 'queued')

        if (expireError) throw expireError
      }

      if (deliverIds.length > 0) {
        const { error: deliverError } = await serviceClient
          .from('notification_jobs')
          .update({ status: 'delivered', updated_at: now.toISOString() })
          .in('id', deliverIds)
          .eq('status', 'queued')

        if (deliverError) throw deliverError
        delivered = deliverIds.length
      }
    }

    return json({ ok: true, created, delivered }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 500)
  }
})
