import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }

function latestSchemaVersion(): string {
  const migrationsDir = resolve(root, 'supabase/migrations')
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const latest = files.at(-1)
  if (!latest) {
    return 'unknown'
  }
  const match = /^(\d+)/.exec(latest)
  return match?.[1] ?? latest
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __SCHEMA_VERSION__: JSON.stringify(latestSchemaVersion()),
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
