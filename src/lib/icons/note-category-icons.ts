/** Suggest an icon when the user types a note/task category. */
const CATEGORY_ICON_MAP: Record<string, string> = {
  stock: 'note-stock',
  handover: 'note-handover',
  delivery: 'note-delivery',
  alert: 'note-alert',
  info: 'note-info',
  checklist: 'task-checklist',
  phone: 'task-phone',
  cleaning: 'task-cleaning',
}

export function suggestIconIdForCategory(category: string | undefined): string | undefined {
  const key = category?.trim().toLowerCase()
  if (!key) return undefined
  return CATEGORY_ICON_MAP[key]
}
