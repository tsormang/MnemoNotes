import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal(process.cwd(), { override: true })

const projectRef = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Could not read project ref from VITE_SUPABASE_URL in .env.local')
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectRef],
  {
    encoding: 'utf8',
    shell: true,
    env: process.env,
  },
)

if (result.status !== 0) {
  console.error(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

writeFileSync('src/lib/database.types.ts', result.stdout)
console.log(`Wrote src/lib/database.types.ts from project ${projectRef}`)
