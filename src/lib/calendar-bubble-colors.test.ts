import { describe, expect, it } from 'vitest'
import {
  buildPersonnelBubbleColorMap,
  getCalendarBubbleColorKey,
  getCalendarBubbleColors,
} from './calendar-bubble-colors'
import { ENTITY_COLOR_PALETTE } from './entity-colors'

describe('calendar-bubble-colors', () => {
  const personnel = [
    { id: 'person-a', colorKey: 'blue' as const },
    { id: 'person-b', colorKey: 'green' as const },
    { id: 'person-c', colorKey: 'purple' as const },
  ]
  const personnelColors = buildPersonnelBubbleColorMap(personnel)

  it('uses the first assignee for shift color keys', () => {
    const key = getCalendarBubbleColorKey({
      kind: 'shift',
      id: 'shift-1',
      assignedPersonnelIds: ['person-a', 'person-b'],
    })

    expect(key).toBe('person-a')
  })

  it('uses stored colorKey for each person', () => {
    expect(personnelColors.get('person-a')).toEqual(ENTITY_COLOR_PALETTE.blue)
    expect(personnelColors.get('person-b')).toEqual(ENTITY_COLOR_PALETTE.green)
    expect(personnelColors.get('person-c')).toEqual(ENTITY_COLOR_PALETTE.purple)
  })

  it('assigns a stable roster color per person', () => {
    const first = getCalendarBubbleColors(
      {
        kind: 'shift',
        id: 'shift-1',
        assignedPersonnelIds: ['person-a'],
      },
      personnelColors,
    )
    const second = getCalendarBubbleColors(
      {
        kind: 'shift',
        id: 'shift-2',
        assignedPersonnelIds: ['person-a'],
      },
      personnelColors,
    )
    const otherPerson = getCalendarBubbleColors(
      {
        kind: 'shift',
        id: 'shift-3',
        assignedPersonnelIds: ['person-b'],
      },
      personnelColors,
    )

    expect(second).toEqual(first)
    expect(otherPerson).not.toEqual(first)
    expect(first).toEqual(ENTITY_COLOR_PALETTE.blue)
  })

  it('does not depend on roster list order', () => {
    const reordered = buildPersonnelBubbleColorMap([
      { id: 'person-c', colorKey: 'purple' },
      { id: 'person-a', colorKey: 'blue' },
      { id: 'person-b', colorKey: 'green' },
    ])

    expect(reordered.get('person-a')).toEqual(ENTITY_COLOR_PALETTE.blue)
    expect(reordered.get('person-b')).toEqual(ENTITY_COLOR_PALETTE.green)
  })

  it('uses kind defaults for notes and tasks', () => {
    expect(
      getCalendarBubbleColors({
        kind: 'note',
        id: 'note-1',
        assignedPersonnelIds: [],
      }).border,
    ).toBe('#d4a017')

    expect(
      getCalendarBubbleColors({
        kind: 'task',
        id: 'task-1',
        assignedPersonnelIds: [],
      }).border,
    ).toBe('#d45a4a')
  })

  it('uses a neutral palette for unassigned shifts', () => {
    expect(
      getCalendarBubbleColors({
        kind: 'shift',
        id: 'shift-1',
        assignedPersonnelIds: [],
      }).border,
    ).toBe('#7a8f99')
  })

  it('uses muted gray when a bubble has passed', () => {
    expect(
      getCalendarBubbleColors(
        {
          kind: 'shift',
          id: 'shift-1',
          assignedPersonnelIds: ['person-a'],
        },
        personnelColors,
        { passed: true },
      ).bg,
    ).toBe('#e8ecea')
  })
})
