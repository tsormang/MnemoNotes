import type { CalendarItem, CalendarItemKind } from '../types/domain'
import {
  colorKeyFromId,
  resolveEntityColors,
  type EntityColorKey,
  type EntityColors,
} from './entity-colors'

export type CalendarBubbleColors = EntityColors

const KIND_DEFAULTS: Record<Exclude<CalendarItemKind, 'shift'>, CalendarBubbleColors> = {
  note: { bg: '#fff4db', border: '#d4a017', text: '#7a5a10' },
  task: { bg: '#ffe8e5', border: '#d45a4a', text: '#8c3028' },
}

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

/** One stable color per roster member from their stored colorKey. */
export function buildPersonnelBubbleColorMap(
  personnel: Array<{ id: string; colorKey?: string | null }>,
): Map<string, CalendarBubbleColors> {
  const map = new Map<string, CalendarBubbleColors>()
  personnel.forEach((person) => {
    const key = (person.colorKey as EntityColorKey | null | undefined) ?? colorKeyFromId(person.id)
    map.set(person.id, resolveEntityColors(key))
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

  return resolveEntityColors(colorKeyFromId(personId))
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
