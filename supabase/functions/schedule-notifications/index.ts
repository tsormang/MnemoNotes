import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing Supabase function environment variables.')
    }

    const authorization = request.headers.get('Authorization') ?? ''
    const cronSecret = Deno.env.get('CRON_SECRET')
    const isCron = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`)

    if (!isCron) {
      const jwt = authorization.replace('Bearer ', '')
      if (!jwt) {
        return json({ error: 'Missing bearer token.' }, 401)
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      })
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser()

      if (userError || !user) {
        return json({ error: 'Invalid session.' }, 401)
      }

      const serviceClient = createClient(supabaseUrl, serviceRoleKey)
      const { data: platformAdmin } = await serviceClient
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!platformAdmin) {
        const { data: memberships } = await serviceClient
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', user.id)
          .eq('status', 'active')

        const orgIds = (memberships ?? []).map((row) => row.organization_id)
        if (orgIds.length === 0) {
          return json({ error: 'Forbidden.' }, 403)
        }

        const { data: permissions } = await serviceClient
          .from('company_role_permissions')
          .select('permission')
          .in(
            'company_role_id',
            (
              await serviceClient
                .from('personnel')
                .select('company_role_id')
                .eq('profile_id', user.id)
                .in('organization_id', orgIds)
            ).data?.map((row) => row.company_role_id) ?? [],
          )

        const isOwner = (memberships ?? []).some((row) => row.role === 'owner')
        const canManage =
          isOwner ||
          (permissions ?? []).some((row) => row.permission === 'notifications.manage')

        if (!canManage) {
          return json({ error: 'Forbidden.' }, 403)
        }
      }
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
      const scheduledFor = computeScheduledFor(
        item.starts_at,
        item.ends_at,
        rule.trigger_kind,
        rule.offset_minutes,
      )

      if (scheduledFor > horizon) continue

      const { data: assignments } = await serviceClient
        .from('shift_assignments')
        .select('personnel_id, personnel:personnel_id(profile_id)')
        .eq('calendar_item_id', rule.calendar_item_id)

      const recipientIds = new Set<string>()
      for (const assignment of assignments ?? []) {
        const profileId = (assignment.personnel as { profile_id: string | null } | null)?.profile_id
        if (profileId) recipientIds.add(profileId)
      }

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
      .select('id')
      .eq('status', 'queued')
      .lte('scheduled_for', now.toISOString())

    if (dueError) throw dueError

    if ((dueJobs ?? []).length > 0) {
      const { error: deliverError } = await serviceClient
        .from('notification_jobs')
        .update({ status: 'delivered', updated_at: now.toISOString() })
        .eq('status', 'queued')
        .lte('scheduled_for', now.toISOString())

      if (deliverError) throw deliverError
      delivered = dueJobs?.length ?? 0
    }

    return json({ ok: true, created, delivered }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 500)
  }
})
