import { spawnSync } from 'node:child_process'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const projectRef = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Could not read project ref from VITE_SUPABASE_URL in .env.local')
  process.exit(1)
}

const functions = [
  { name: 'admin-records', public: false },
  { name: 'admin-provision-company', public: false },
  { name: 'admin-invite-owner', public: false },
  { name: 'invite-personnel', public: false },
  { name: 'accept-invite', public: true },
  { name: 'schedule-notifications', public: false },
  { name: 'dispatch-push-notifications', public: false },
  { name: 'register-device', public: false },
  { name: 'process-notifications', public: false },
]

function runSupabase(args) {
  const result = spawnSync('npx', ['supabase', ...args], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      SUPABASE_OUTPUT_FORMAT: undefined,
      CI: undefined,
    },
  })

  if (result.status !== 0) {
    console.error(`\nCommand failed: npx supabase ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`Deploying Edge Functions to ${projectRef}...\n`)

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.log('Tip: add SUPABASE_ACCESS_TOKEN to .env.local for non-interactive deploy.')
  console.log('Dashboard -> Account -> Access Tokens\n')
}

runSupabase(['link', '--project-ref', projectRef])

for (const fn of functions) {
  console.log(`\nDeploying ${fn.name}...`)
  const args = ['functions', 'deploy', fn.name]
  if (fn.public) {
    args.push('--no-verify-jwt')
  }
  runSupabase(args)
}

console.log('\nDone. Retry company creation in /admin.')
