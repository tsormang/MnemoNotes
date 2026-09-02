/**
 * Send one FCM test push through the live dispatch edge function.
 * Usage: node scripts/test-fcm-push.mjs [user-email]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const cronSecret = process.env.CRON_SECRET
const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/test-fcm-push.mjs <user-email>')
  process.exit(1)
}

if (!url || !serviceRoleKey || !cronSecret) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CRON_SECRET in .env.local')
  process.exit(1)
}

const sb = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: authData } = await sb.auth.admin.listUsers({ perPage: 200 })
const user = authData?.users?.find((entry) => entry.email?.toLowerCase() === email)
if (!user) {
  console.error(`No user found for ${email}`)
  process.exit(1)
}

const { data: membership } = await sb
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle()

if (!membership) {
  console.error(`${email} has no active organization membership`)
  process.exit(1)
}

const { data: sub } = await sb
  .from('device_subscriptions')
  .select('token, last_seen_at')
  .eq('user_id', user.id)
  .eq('organization_id', membership.organization_id)
  .eq('channel', 'fcm')
  .limit(1)
  .maybeSingle()

if (!sub) {
  console.error(`No FCM token for ${email}. Enable mobile alerts on the phone first.`)
  process.exit(1)
}

const now = new Date().toISOString()
const { data: job, error: insertError } = await sb
  .from('notification_jobs')
  .insert({
    organization_id: membership.organization_id,
    recipient_user_id: user.id,
    scheduled_for: now,
    status: 'delivered',
    idempotency_key: `fcm-test-${Date.now()}`,
    payload: {
      calendarItemId: 'fcm-test',
      title: 'MnemoNotes FCM test',
      kind: 'note',
      requiresAcknowledgement: false,
      triggerKind: 'at_start',
      offsetMinutes: 0,
    },
  })
  .select('id')
  .single()

if (insertError) {
  console.error('Failed to create test job:', insertError.message)
  process.exit(1)
}

console.log(`Created test job ${job.id} for ${email}`)
console.log(`Token last seen: ${sub.last_seen_at}`)
console.log('Background the app now, then waiting for dispatch…\n')

const res = await fetch(`${url}/functions/v1/process-notifications`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
})

const body = await res.json()
console.log('process-notifications:', JSON.stringify(body, null, 2))

const { data: result } = await sb
  .from('notification_jobs')
  .select('status, push_sent_at, last_error, attempts')
  .eq('id', job.id)
  .single()

console.log('\nJob result:', result)

await sb.from('notification_jobs').delete().eq('id', job.id)

if (result?.push_sent_at) {
  console.log('\n✓ FCM accepted the message. Check your phone notification shade.')
} else if (body.dispatch?.skipped) {
  console.log('\n✗ FCM_SERVICE_ACCOUNT is not set in Supabase secrets.')
} else {
  console.log('\n✗ Push was not sent. See dispatch output above.')
  process.exit(1)
}
