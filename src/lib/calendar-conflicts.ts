import type { CalendarItem } from '../types/domain'

export interface ShiftConflict {
  personnelId: string
  conflictingItemId: string
  conflictingTitle: string
}

/** Detect overlapping shift assignments for the same personnel (excluding the item being edited). */
export function findShiftConflicts(
  items: CalendarItem[],
  candidate: Pick<CalendarItem, 'id' | 'kind' | 'startsAt' | 'endsAt' | 'assignedPersonnelIds'>,
): ShiftConflict[] {
  if (candidate.kind !== 'shift' || candidate.assignedPersonnelIds.length === 0) {
    return []
  }

  const candidateStart = new Date(candidate.startsAt).getTime()
  const candidateEnd = new Date(candidate.endsAt).getTime()

  const conflicts: ShiftConflict[] = []

  for (const personId of candidate.assignedPersonnelIds) {
    for (const item of items) {
      if (item.id === candidate.id || item.kind !== 'shift') continue
      if (!item.assignedPersonnelIds.includes(personId)) continue

      const itemStart = new Date(item.startsAt).getTime()
      const itemEnd = new Date(item.endsAt).getTime()

      if (candidateStart < itemEnd && candidateEnd > itemStart) {
        conflicts.push({
          personnelId: personId,
          conflictingItemId: item.id,
          conflictingTitle: item.title,
        })
      }
    }
  }

  return conflicts
}

export function itemHasShiftConflict(items: CalendarItem[], item: CalendarItem): boolean {
  return findShiftConflicts(items, item).length > 0
}
