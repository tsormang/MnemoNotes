/**
 * Diagnose why mobile / background notifications may not fire.
 * Usage: node scripts/diagnose-notifications.mjs [user-email]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const cronSecret = process.env.CRON_SECRET

if (!url || !serviceRoleKey) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const emailFilter = process.argv[2]?.trim().toLowerCase()
const sb = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('MnemoNotes notification diagnostics\n')

const { data: authData } = await sb.auth.admin.listUsers({ perPage: 200 })
const users = authData?.users ?? []
const filtered = emailFilter
  ? users.filter((user) => user.email?.toLowerCase() === emailFilter)
  : users

if (emailFilter && filtered.length === 0) {
  console.log(`No auth user found for email: ${emailFilter}`)
  process.exit(1)
}

const { data: subs } = await sb.from('device_subscriptions').select('*')
const { data: jobs } = await sb
  .from('notification_jobs')
  .select('id, organization_id, recipient_user_id, status, scheduled_for, push_sent_at, last_error, payload')
  .order('scheduled_for', { ascending: false })
  .limit(30)

const now = Date.now()
const jobCounts = {}
for (const job of jobs ?? []) {
  jobCounts[job.status] = (jobCounts[job.status] ?? 0) + 1
}

console.log('--- Pipeline status ---')
console.log(`Now (UTC): ${new Date().toISOString()}`)
console.log(`Job sample counts: ${JSON.stringify(jobCounts)}`)

const overdueQueued = (jobs ?? []).filter(
  (job) => job.status === 'queued' && new Date(job.scheduled_for).getTime() <= now,
)
if (overdueQueued.length > 0) {
  console.log(`\n⚠ ${overdueQueued.length} job(s) still queued past scheduled_for`)
  console.log('  → Background cron may not be running, or process-notifications is not deployed')
  console.log('    with --no-verify-jwt. Redeploy: pnpm functions:deploy')
  console.log('  → Or tap Refresh in the Notifications panel while the app is open.')
}

const deliveredUnpushed = (jobs ?? []).filter(
  (job) => job.status === 'delivered' && !job.push_sent_at,
)
if (deliveredUnpushed.length > 0) {
  console.log(`\n⚠ ${deliveredUnpushed.length} delivered job(s) without push_sent_at`)
  console.log('  → Check FCM_SERVICE_ACCOUNT secret in Supabase Edge Function secrets.')
}

if ((subs ?? []).length === 0) {
  console.log('\n⚠ No device_subscriptions rows')
  console.log('  → On the phone: Notifications panel → Enable mobile alerts (after sign-in).')
}

console.log('\n--- Device registrations ---')
for (const sub of subs ?? []) {
  const user = users.find((entry) => entry.id === sub.user_id)
  console.log(
    `• ${user?.email ?? sub.user_id} | org ${sub.organization_id.slice(0, 8)}… | ${sub.platform} | last seen ${sub.last_seen_at}`,
  )
}

console.log('\n--- Users, orgs, and push alignment ---')
for (const user of filtered) {
  const { data: memberships } = await sb
    .from('organization_members')
    .select('organization_id, role, status')
    .eq('user_id', user.id)

  const userSubs = (subs ?? []).filter((sub) => sub.user_id === user.id)
  const userJobs = (jobs ?? []).filter((job) => job.recipient_user_id === user.id)
  const activeJobs = userJobs.filter((job) =>
    ['queued', 'delivered', 'sent'].includes(job.status),
  )

  console.log(`\n${user.email} (${user.id.slice(0, 8)}…)`)
  console.log(`  Orgs: ${(memberships ?? []).map((m) => `${m.organization_id.slice(0, 8)}… (${m.role})`).join(', ') || 'none'}`)
  console.log(`  Push tokens: ${userSubs.length}`)
  console.log(`  Recent notification jobs: ${userJobs.length} (${activeJobs.length} active)`)

  for (const sub of userSubs) {
    const orgMatch = (memberships ?? []).some((m) => m.organization_id === sub.organization_id)
    if (!orgMatch) {
      console.log('  ⚠ Push token registered for an org this user is not a member of.')
    }
  }

  for (const job of activeJobs.slice(0, 5)) {
    const due = new Date(job.scheduled_for).getTime() <= now
    const hasPush = userSubs.some(
      (sub) =>
        sub.organization_id === job.organization_id && sub.channel === 'fcm',
    )
    const pushOk = due ? (hasPush ? 'push route OK' : 'NO push token for this org') : 'not due yet'
    const title = job.payload?.title ?? '(untitled)'
    console.log(
      `  • [${job.status}] ${title} @ ${job.scheduled_for} — ${pushOk}`,
    )
  }
}

if (cronSecret) {
  console.log('\n--- Cron reachability ---')
  const res = await fetch(`${url}/functions/v1/process-notifications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const body = await res.text()
  if (res.ok) {
    console.log(`✓ process-notifications responded ${res.status}: ${body}`)
  } else if (body.includes('UNAUTHORIZED_INVALID_JWT')) {
    console.log('✗ process-notifications rejected CRON_SECRET at gateway (Invalid JWT)')
    console.log('  → Redeploy with: pnpm functions:deploy (process-notifications uses --no-verify-jwt)')
  } else {
    console.log(`✗ process-notifications ${res.status}: ${body}`)
  }
} else {
  console.log('\n? CRON_SECRET not in .env.local — skipping cron reachability test')
}

console.log('\nDone.')
