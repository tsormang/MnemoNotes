import { parseISO } from 'date-fns'
import type { CalendarItem, CalendarItemKind } from '../types/domain'

export interface CopyTargetLike {
  startsAt: string
  endsAt: string
  sourceItem: CalendarItem
}

export interface CopyConflictAnalysis {
  clearTargetCount: number
  conflictTargetCount: number
  conflictingItemIds: string[]
  replaceableItemIds: string[]
  noteConflicts: number
  shiftConflicts: number
  hasConflicts: boolean
  conflictedTargetKeys: string[]
}

const COPY_CONFLICT_KINDS = new Set<CalendarItemKind>(['note', 'shift'])

export function rangesOverlap(
  startsAtA: string,
  endsAtA: string,
  startsAtB: string,
  endsAtB: string,
): boolean {
  const aStart = parseISO(startsAtA).getTime()
  const aEnd = parseISO(endsAtA).getTime()
  const bStart = parseISO(startsAtB).getTime()
  const bEnd = parseISO(endsAtB).getTime()
  return aStart < bEnd && aEnd > bStart
}

export function copyTargetKey(target: CopyTargetLike): string {
  return `${target.startsAt}|${target.endsAt}|${target.sourceItem.id}`
}

/** Overlapping notes or shifts in the copy timeframe (same kind only). */
export function findTargetConflicts(
  target: CopyTargetLike,
  allItems: CalendarItem[],
  excludeItemIds: string[] = [],
): CalendarItem[] {
  const kind = target.sourceItem.kind
  if (!COPY_CONFLICT_KINDS.has(kind)) return []

  const exclude = new Set(excludeItemIds)

  return allItems.filter((item) => {
    if (exclude.has(item.id)) return false
    if (item.kind !== kind) return false
    return rangesOverlap(target.startsAt, target.endsAt, item.startsAt, item.endsAt)
  })
}

export function analyzeCopyConflicts(
  targets: CopyTargetLike[],
  allItems: CalendarItem[],
  canDeleteItem: (item: CalendarItem) => boolean,
  excludeItemIds: string[] = [],
): CopyConflictAnalysis {
  const conflictingItemIds = new Set<string>()
  const conflictedTargetKeys: string[] = []
  let noteConflicts = 0
  let shiftConflicts = 0
  let clearTargetCount = 0

  for (const target of targets) {
    const conflicts = findTargetConflicts(target, allItems, excludeItemIds)
    if (conflicts.length === 0) {
      clearTargetCount++
      continue
    }

    conflictedTargetKeys.push(copyTargetKey(target))
    if (target.sourceItem.kind === 'note') noteConflicts++
    if (target.sourceItem.kind === 'shift') shiftConflicts++
    for (const item of conflicts) {
      conflictingItemIds.add(item.id)
    }
  }

  const ids = [...conflictingItemIds]
  const replaceableItemIds = ids.filter((id) => {
    const item = allItems.find((entry) => entry.id === id)
    return item ? canDeleteItem(item) : false
  })

  return {
    clearTargetCount,
    conflictTargetCount: conflictedTargetKeys.length,
    conflictingItemIds: ids,
    replaceableItemIds,
    noteConflicts,
    shiftConflicts,
    hasConflicts: conflictedTargetKeys.length > 0,
    conflictedTargetKeys,
  }
}

export function filterCopyTargetsByKeys(
  targets: CopyTargetLike[],
  skipKeys: string[],
): CopyTargetLike[] {
  const skip = new Set(skipKeys)
  return targets.filter((target) => !skip.has(copyTargetKey(target)))
}

export function canReplaceCopyConflicts(analysis: CopyConflictAnalysis): boolean {
  return (
    analysis.conflictingItemIds.length > 0 &&
    analysis.replaceableItemIds.length === analysis.conflictingItemIds.length
  )
}
