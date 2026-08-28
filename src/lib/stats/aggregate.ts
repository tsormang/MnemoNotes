import { eachDayOfInterval, format, isWithinInterval, parseISO } from 'date-fns'
import type { CalendarItem, CalendarItemKind } from '../../types/domain'

export interface StatsDateRange {
  start: Date
  end: Date
}

export interface StatsPersonnelInput {
  id: string
  fullName: string
  companyRoleName: string
}

export interface PersonnelStatsRow {
  personnelId: string
  fullName: string
  companyRoleName: string
  shiftHours: number
  shiftCount: number
  noteCount: number
  taskCount: number
}

export interface DailyShiftHours {
  date: string
  hours: number
  shiftCount: number
}

export interface RoleHoursRow {
  roleName: string
  hours: number
  personnelCount: number
}

export interface WorkspaceStatsReport {
  rangeLabel: string
  totalShiftHours: number
  totalShifts: number
  totalNotes: number
  totalTasks: number
  unassignedShifts: number
  personnelRows: PersonnelStatsRow[]
  dailyShiftHours: DailyShiftHours[]
  roleHours: RoleHoursRow[]
}

function itemOverlapsRange(item: CalendarItem, range: StatsDateRange): boolean {
  const start = parseISO(item.startsAt)
  const end = parseISO(item.endsAt)
  return start < range.end && end > range.start
}

function itemDurationHours(item: CalendarItem): number {
  const start = parseISO(item.startsAt).getTime()
  const end = parseISO(item.endsAt).getTime()
  return Math.max(0, (end - start) / (1000 * 60 * 60))
}

function createEmptyRow(person: StatsPersonnelInput): PersonnelStatsRow {
  return {
    personnelId: person.id,
    fullName: person.fullName,
    companyRoleName: person.companyRoleName,
    shiftHours: 0,
    shiftCount: 0,
    noteCount: 0,
    taskCount: 0,
  }
}

function incrementKindCount(row: PersonnelStatsRow, kind: CalendarItemKind, hours = 0) {
  if (kind === 'shift') {
    row.shiftCount += 1
    row.shiftHours += hours
    return
  }
  if (kind === 'note') {
    row.noteCount += 1
    return
  }
  row.taskCount += 1
}

export function buildWorkspaceStatsReport(input: {
  range: StatsDateRange
  rangeLabel: string
  items: CalendarItem[]
  personnel: StatsPersonnelInput[]
}): WorkspaceStatsReport {
  const { range, rangeLabel, items, personnel } = input
  const inRange = items.filter((item) => itemOverlapsRange(item, range))

  const rowByPersonId = new Map(personnel.map((person) => [person.id, createEmptyRow(person)]))
  const dailyMap = new Map<string, DailyShiftHours>()
  const roleHoursMap = new Map<string, { hours: number; personnelIds: Set<string> }>()

  let totalShiftHours = 0
  let totalShifts = 0
  let totalNotes = 0
  let totalTasks = 0
  let unassignedShifts = 0

  for (const day of eachDayOfInterval({ start: range.start, end: range.end })) {
    dailyMap.set(format(day, 'yyyy-MM-dd'), { date: format(day, 'yyyy-MM-dd'), hours: 0, shiftCount: 0 })
  }

  for (const item of inRange) {
    const durationHours = itemDurationHours(item)

    if (item.kind === 'shift') {
      totalShifts += 1
      totalShiftHours += durationHours

      const dayKey = format(parseISO(item.startsAt), 'yyyy-MM-dd')
      const daily = dailyMap.get(dayKey)
      if (daily) {
        daily.hours += durationHours
        daily.shiftCount += 1
      }

      if (item.assignedPersonnelIds.length === 0) {
        unassignedShifts += 1
      }

      for (const personId of item.assignedPersonnelIds) {
        const row = rowByPersonId.get(personId)
        if (!row) continue

        incrementKindCount(row, 'shift', durationHours)

        const roleKey = row.companyRoleName
        const roleEntry = roleHoursMap.get(roleKey) ?? { hours: 0, personnelIds: new Set<string>() }
        roleEntry.hours += durationHours
        roleEntry.personnelIds.add(personId)
        roleHoursMap.set(roleKey, roleEntry)
      }
      continue
    }

    if (item.kind === 'note') {
      totalNotes += 1
    } else {
      totalTasks += 1
    }

    const assignees = item.assignedPersonnelIds
    if (assignees.length === 0) continue

    for (const personId of assignees) {
      const row = rowByPersonId.get(personId)
      if (!row) continue
      incrementKindCount(row, item.kind)
    }
  }

  const personnelRows = [...rowByPersonId.values()]
    .filter((row) => row.shiftCount > 0 || row.noteCount > 0 || row.taskCount > 0)
    .sort((left, right) => right.shiftHours - left.shiftHours || left.fullName.localeCompare(right.fullName))

  const roleHours = [...roleHoursMap.entries()]
    .map(([roleName, entry]) => ({
      roleName,
      hours: entry.hours,
      personnelCount: entry.personnelIds.size,
    }))
    .sort((left, right) => right.hours - left.hours || left.roleName.localeCompare(right.roleName))

  return {
    rangeLabel,
    totalShiftHours,
    totalShifts,
    totalNotes,
    totalTasks,
    unassignedShifts,
    personnelRows,
    dailyShiftHours: [...dailyMap.values()],
    roleHours,
  }
}

export function filterItemsForDrillDown(
  items: CalendarItem[],
  range: StatsDateRange,
  filters: { personnelId?: string | null; kind?: CalendarItemKind | 'all' },
): CalendarItem[] {
  return items.filter((item) => {
    if (!itemOverlapsRange(item, range)) return false
    if (filters.kind && filters.kind !== 'all' && item.kind !== filters.kind) return false
    if (filters.personnelId && !item.assignedPersonnelIds.includes(filters.personnelId)) return false
    return true
  })
}

export function isDateInRange(date: Date, range: StatsDateRange): boolean {
  return isWithinInterval(date, { start: range.start, end: range.end })
}
