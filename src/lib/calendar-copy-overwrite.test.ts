import { describe, expect, it } from 'vitest'
import {
  analyzeCopyConflicts,
  findTargetConflicts,
  filterCopyTargetsByKeys,
  rangesOverlap,
  copyTargetKey,
} from './calendar-copy-overwrite'
import type { CalendarItem } from '../types/domain'

function makeItem(
  id: string,
  kind: CalendarItem['kind'],
  startsAt: string,
  endsAt = startsAt.replace('T06:', 'T14:'),
): CalendarItem {
  return {
    id,
    kind,
    title: kind === 'note' ? 'Note' : '',
    startsAt,
    endsAt,
    locationId: 'loc',
    assignedPersonnelIds: [],
    priority: 'normal',
    notificationOffsets: [],
    requiresAcknowledgement: false,
  }
}

describe('calendar-copy-overwrite', () => {
  it('detects overlapping time ranges', () => {
    expect(
      rangesOverlap(
        '2026-08-28T06:00:00.000Z',
        '2026-08-28T14:00:00.000Z',
        '2026-08-28T08:00:00.000Z',
        '2026-08-28T10:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      rangesOverlap(
        '2026-08-28T06:00:00.000Z',
        '2026-08-28T08:00:00.000Z',
        '2026-08-28T08:00:00.000Z',
        '2026-08-28T10:00:00.000Z',
      ),
    ).toBe(false)
  })

  it('finds overlapping notes but ignores shifts on the same day', () => {
    const note = makeItem('note', 'note', '2026-08-27T06:00:00.000Z')
    const items = [
      makeItem('existing-note', 'note', '2026-08-28T08:00:00.000Z', '2026-08-28T10:00:00.000Z'),
      makeItem('existing-shift', 'shift', '2026-08-28T08:00:00.000Z', '2026-08-28T10:00:00.000Z'),
    ]
    const target = {
      sourceItem: note,
      startsAt: '2026-08-28T06:00:00.000Z',
      endsAt: '2026-08-28T14:00:00.000Z',
    }

    expect(findTargetConflicts(target, items)).toHaveLength(1)
    expect(findTargetConflicts(target, items)[0].kind).toBe('note')
  })

  it('treats non-overlapping notes on the same day as clear', () => {
    const note = makeItem('note', 'note', '2026-08-27T06:00:00.000Z')
    const items = [
      makeItem('existing-note', 'note', '2026-08-28T06:00:00.000Z', '2026-08-28T07:00:00.000Z'),
    ]
    const target = {
      sourceItem: note,
      startsAt: '2026-08-28T08:00:00.000Z',
      endsAt: '2026-08-28T14:00:00.000Z',
    }

    const analysis = analyzeCopyConflicts([target], items, () => true)
    expect(analysis.hasConflicts).toBe(false)
    expect(analysis.clearTargetCount).toBe(1)
  })

  it('filters conflicted targets when ignoring overlaps', () => {
    const shift = makeItem('shift', 'shift', '2026-08-27T06:00:00.000Z')
    const targets = [
      { sourceItem: shift, startsAt: '2026-08-28T06:00:00.000Z', endsAt: '2026-08-28T14:00:00.000Z' },
      { sourceItem: shift, startsAt: '2026-08-29T06:00:00.000Z', endsAt: '2026-08-29T14:00:00.000Z' },
    ]

    const kept = filterCopyTargetsByKeys(targets, [copyTargetKey(targets[0])])
    expect(kept).toHaveLength(1)
    expect(kept[0].startsAt).toContain('2026-08-29')
  })
})
