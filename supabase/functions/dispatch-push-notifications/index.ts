import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authorizeNotificationManager, isCronRequest } from '../_shared/cron-auth.ts'
import { sendFcmMessage } from '../_shared/fcm.ts'
import { corsHeaders, json } from '../_shared/http.ts'

interface NotificationJobRow {
  id: string
  organization_id: string
  recipient_user_id: string | null
  payload: Record<string, unknown>
  attempts: number
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

    if (!Deno.env.get('FCM_SERVICE_ACCOUNT')) {
      return json({ ok: true, skipped: true, reason: 'FCM not configured' }, 200)
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const now = new Date().toISOString()

    // Include status "sent" jobs that never received push — the in-app toast path
    // previously marked jobs sent before FCM could run.
    const { data: jobs, error: jobsError } = await serviceClient
      .from('notification_jobs')
      .select('id, organization_id, recipient_user_id, payload, attempts')
      .in('status', ['delivered', 'sent'])
      .is('push_sent_at', null)
      .lte('scheduled_for', now)
      .limit(100)

    if (jobsError) throw jobsError

    let sent = 0
    let failed = 0

    for (const job of (jobs ?? []) as NotificationJobRow[]) {
      if (!job.recipient_user_id) continue

      const payload = job.payload ?? {}
      const calendarItemId = String(payload.calendarItemId ?? '')
      const title = String(payload.title ?? 'MnemoNotes reminder')
      const kind = String(payload.kind ?? 'note')
      const requiresAcknowledgement = Boolean(payload.requiresAcknowledgement)
      const body = requiresAcknowledgement ? 'Acknowledgement required' : `${kind} reminder`

      const { data: subscriptions, error: subsError } = await serviceClient
        .from('device_subscriptions')
        .select('token')
        .eq('user_id', job.recipient_user_id)
        .eq('organization_id', job.organization_id)
        .eq('channel', 'fcm')

      if (subsError) {
        failed += 1
        await serviceClient
          .from('notification_jobs')
          .update({
            attempts: job.attempts + 1,
            last_error: subsError.message,
            updated_at: now,
          })
          .eq('id', job.id)
        continue
      }

      if ((subscriptions ?? []).length === 0) {
        continue
      }

      let jobSent = false
      let lastError: string | null = null

      for (const subscription of subscriptions ?? []) {
        try {
          await sendFcmMessage(subscription.token, {
            title,
            body,
            data: {
              jobId: job.id,
              calendarItemId,
              kind,
              requiresAcknowledgement: String(requiresAcknowledgement),
            },
          })
          jobSent = true
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'FCM send failed.'
        }
      }

      if (jobSent) {
        sent += 1
        await serviceClient
          .from('notification_jobs')
          .update({
            status: 'sent',
            push_sent_at: now,
            updated_at: now,
            last_error: null,
          })
          .eq('id', job.id)
      } else if (lastError) {
        failed += 1
        await serviceClient
          .from('notification_jobs')
          .update({
            attempts: job.attempts + 1,
            last_error: lastError,
            updated_at: now,
          })
          .eq('id', job.id)
      }
    }

    return json({ ok: true, sent, failed, cron: isCronRequest(request) }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json({ error: message }, 500)
  }
})
