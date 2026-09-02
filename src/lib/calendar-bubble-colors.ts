import type { CalendarItem, CalendarItemKind } from '../types/domain'

export type CalendarBubbleColors = {
  bg: string
  border: string
  text: string
}

const KIND_DEFAULTS: Record<Exclude<CalendarItemKind, 'shift'>, CalendarBubbleColors> = {
  note: { bg: '#fff4db', border: '#d4a017', text: '#7a5a10' },
  task: { bg: '#ffe8e5', border: '#d45a4a', text: '#8c3028' },
}

/** Distinct soft palettes so adjacent shift bubbles are easy to tell apart. */
const SHIFT_PALETTE: CalendarBubbleColors[] = [
  { bg: '#e8f1ff', border: '#3b82c4', text: '#1e4f8c' },
  { bg: '#e3f2e8', border: '#3d8b6a', text: '#1e5a42' },
  { bg: '#f0e8f8', border: '#7b52ab', text: '#4a2878' },
  { bg: '#fff0e6', border: '#d4783a', text: '#8c4518' },
  { bg: '#e8f4f8', border: '#2a8fa8', text: '#1a5a6b' },
  { bg: '#fce8f0', border: '#c45a8a', text: '#8c2848' },
  { bg: '#f2f0e8', border: '#8a7a3a', text: '#5a4a18' },
  { bg: '#e8eef8', border: '#4a6ab8', text: '#2a4278' },
]

const UNASSIGNED_SHIFT: CalendarBubbleColors = {
  bg: '#eef2f4',
  border: '#7a8f99',
  text: '#3d4f57',
}

export const PASSED_BUBBLE_COLORS: CalendarBubbleColors = {
  bg: '#e8ecea',
  border: '#b8c4c0',
  text: '#6b7d77',
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

/** One stable color per roster member so shifts on the same day are visually distinct. */
export function buildPersonnelBubbleColorMap(
  personnel: Array<{ id: string }>,
): Map<string, CalendarBubbleColors> {
  const map = new Map<string, CalendarBubbleColors>()
  personnel.forEach((person, index) => {
    map.set(person.id, SHIFT_PALETTE[index % SHIFT_PALETTE.length])
  })
  return map
}

export function getCalendarBubbleColorKey(
  item: Pick<CalendarItem, 'kind' | 'id' | 'assignedPersonnelIds'>,
): string {
  if (item.kind === 'shift') {
    return item.assignedPersonnelIds[0] ?? `unassigned:${item.id}`
  }

  return `${item.kind}:${item.id}`
}

export function getCalendarBubbleColors(
  item: Pick<CalendarItem, 'kind' | 'id' | 'assignedPersonnelIds'>,
  personnelColors?: Map<string, CalendarBubbleColors>,
  options?: { passed?: boolean },
): CalendarBubbleColors {
  if (options?.passed) {
    return PASSED_BUBBLE_COLORS
  }

  if (item.kind !== 'shift') {
    return KIND_DEFAULTS[item.kind]
  }

  const personId = item.assignedPersonnelIds[0]
  if (!personId) {
    return UNASSIGNED_SHIFT
  }

  const rosterColor = personnelColors?.get(personId)
  if (rosterColor) {
    return rosterColor
  }

  return SHIFT_PALETTE[hashString(personId) % SHIFT_PALETTE.length]
}

export function applyCalendarBubbleColors(
  element: HTMLElement,
  colors: CalendarBubbleColors,
): void {
  element.style.setProperty('background-color', colors.bg, 'important')
  element.style.setProperty('color', colors.text, 'important')
  element.style.setProperty('border-left', `3px solid ${colors.border}`, 'important')
  element.style.setProperty('--event-bubble-bg', colors.bg)
  element.style.setProperty('--event-bubble-border', colors.border)
  element.style.setProperty('--event-bubble-text', colors.text)
}

export const CONFLICT_BUBBLE_COLORS: CalendarBubbleColors = {
  bg: '#fffdf5',
  border: '#f5c542',
  text: '#7a5a10',
}

export function toCalendarBubbleStyle(colors: CalendarBubbleColors): {
  backgroundColor: string
  borderColor: string
  color: string
  borderLeftWidth: number
} {
  return {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    color: colors.text,
    borderLeftWidth: 3,
  }
}

export function resolveCalendarBubbleColors(
  item: Pick<CalendarItem, 'kind' | 'id' | 'assignedPersonnelIds'>,
  options: {
    personnelColors?: Map<string, CalendarBubbleColors>
    passed?: boolean
    conflict?: boolean
  } = {},
): CalendarBubbleColors {
  if (options.conflict) {
    return CONFLICT_BUBBLE_COLORS
  }

  return getCalendarBubbleColors(item, options.personnelColors, { passed: options.passed })
}
