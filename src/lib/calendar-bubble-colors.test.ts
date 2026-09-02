import { describe, expect, it } from 'vitest'
import {
  buildPersonnelBubbleColorMap,
  getCalendarBubbleColorKey,
  getCalendarBubbleColors,
} from './calendar-bubble-colors'

describe('calendar-bubble-colors', () => {
  const personnel = [
    { id: 'person-a' },
    { id: 'person-b' },
    { id: 'person-c' },
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
  })

  it('gives each roster member a different palette entry when possible', () => {
    expect(personnelColors.get('person-a')?.bg).not.toBe(personnelColors.get('person-b')?.bg)
    expect(personnelColors.get('person-b')?.bg).not.toBe(personnelColors.get('person-c')?.bg)
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
