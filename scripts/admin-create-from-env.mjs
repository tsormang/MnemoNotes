import { loadEnvLocal, validateHostedEnv } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const errors = validateHostedEnv()

if (errors.length > 0) {
  console.error('Fix .env.local before running hosted setup:\n')
  for (const error of errors) {
    console.error(`  • ${error}`)
  }
  console.error('\nDashboard: Project Settings → API')
  console.error('  • Project URL → VITE_SUPABASE_URL / SUPABASE_URL')
  console.error('  • Publishable key → VITE_SUPABASE_PUBLISHABLE_KEY')
  console.error('  • service_role (Reveal) → SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('Environment looks valid. Running admin:create…\n')

await import('./create-platform-admin.mjs')
