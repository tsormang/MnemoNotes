import { loadEnvLocal, validateHostedEnv } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const errors = validateHostedEnv()

if (errors.length > 0) {
  console.error('Fix .env.local:\n')
  for (const error of errors) {
    console.error(`  • ${error}`)
  }
  console.error('\nSupabase Dashboard → Project Settings → API → service_role (Reveal)')
  process.exit(1)
}

console.log('Environment OK for hosted setup.')
