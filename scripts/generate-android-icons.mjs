import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const source = path.join(root, 'public/icons/MnemoNotes_logo.png')
const target = path.join(root, 'assets/icon.png')
const iconBackgroundColor = '#3A8F85'

if (!fs.existsSync(source)) {
  console.error(`Missing logo source: ${source}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.copyFileSync(source, target)

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['capacitor-assets', 'generate', '--android', '--iconBackgroundColor', iconBackgroundColor],
  { stdio: 'inherit', cwd: root },
)

process.exit(result.status ?? 1)
