import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'public/icons/entities')
fs.mkdirSync(dir, { recursive: true })

function svg(label, bg, fg = '#ffffff') {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const fontSize = label.length > 2 ? 9 : 11
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-hidden="true">',
    `  <circle cx="16" cy="16" r="16" fill="${bg}"/>`,
    `  <text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${safe}</text>`,
    '</svg>',
  ].join('\n')
}

const personColors = [
  '#0d9488',
  '#14b8a6',
  '#2dd4bf',
  '#0891b2',
  '#06b6d4',
  '#0284c7',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
]

/** @type {Array<[string, string, string]>} */
const icons = [
  ['org-default', 'O', '#2563eb'],
  ['org-pharmacy', 'Rx', '#1d4ed8'],
  ['org-clinic', 'Cl', '#3b82f6'],
  ['org-store', 'St', '#60a5fa'],
  ...personColors.map((color, index) => {
    const id = index === 0 ? 'person-default' : `person-${String(index).padStart(2, '0')}`
    const label = index === 0 ? 'P' : String(index)
    return /** @type {[string, string, string]} */ ([id, label, color])
  }),
  ['role-user-cog', 'Mg', '#7c3aed'],
  ['role-pill', 'Rx', '#059669'],
  ['role-eye', 'Vi', '#64748b'],
  ['note-default', 'N', '#ca8a04'],
  ['note-stock', 'Sk', '#eab308'],
  ['note-handover', 'Ho', '#f59e0b'],
  ['note-delivery', 'Dl', '#d97706'],
  ['note-alert', '!', '#dc2626'],
  ['note-info', 'i', '#2563eb'],
  ['task-default', 'T', '#9333ea'],
  ['task-checklist', 'Ck', '#7e22ce'],
  ['task-phone', 'Ph', '#6d28d9'],
  ['task-cleaning', 'Cl', '#5b21b6'],
]

for (const [id, label, bg] of icons) {
  fs.writeFileSync(path.join(dir, `${id}.svg`), svg(label, bg))
}

console.log(`Created ${icons.length} placeholder icons in ${dir}`)
