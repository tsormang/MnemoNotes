import type { CalendarItem, CalendarItemKind } from '../types/domain'

type NamedPerson = { id: string; fullName: string }

/** Primary label for shift bubbles — assigned staff names, or a fallback when empty. */
export function formatShiftStaffLabel(assignees: Array<{ fullName: string }>): string {
  if (assignees.length === 0) return 'Unassigned shift'
  if (assignees.length <= 2) return assignees.map((person) => person.fullName).join(', ')
  return `${assignees[0].fullName}, +${assignees.length - 1}`
}

export function getCalendarItemDisplayLabel(
  item: Pick<CalendarItem, 'kind' | 'title' | 'assignedPersonnelIds'>,
  personnel: NamedPerson[],
): string {
  if (item.kind === 'shift') {
    const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
    return formatShiftStaffLabel(assignees)
  }

  return item.title.trim() || 'Untitled'
}

export function calendarItemRequiresTitle(kind: CalendarItemKind): boolean {
  return kind !== 'shift'
}
