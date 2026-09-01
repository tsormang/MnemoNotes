import type { CalendarItem, CalendarItemKind } from '../types/domain'

export function isTaskKind(kind: CalendarItemKind | string): boolean {
  return kind === 'task'
}

export function filterVisibleCalendarItems<T extends Pick<CalendarItem, 'kind'>>(
  items: T[],
  showTasks: boolean,
): T[] {
  if (showTasks) return items
  return items.filter((item) => !isTaskKind(item.kind))
}

export function filterVisibleTaskKinds<T extends { kind: CalendarItemKind | string }>(
  items: T[],
  showTasks: boolean,
): T[] {
  if (showTasks) return items
  return items.filter((item) => !isTaskKind(item.kind))
}

export function visibleCalendarKinds(
  kinds: CalendarItemKind[],
  showTasks: boolean,
): CalendarItemKind[] {
  if (showTasks) return kinds
  return kinds.filter((kind) => !isTaskKind(kind))
}
