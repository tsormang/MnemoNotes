import { format } from 'date-fns'
import type { WorkspaceStatsReport } from './aggregate'

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildStatsCsv(report: WorkspaceStatsReport, organizationName: string): string {
  const lines: string[] = [
    `Organization,${escapeCsvCell(organizationName)}`,
    `Period,${escapeCsvCell(report.rangeLabel)}`,
    `Generated,${escapeCsvCell(format(new Date(), 'yyyy-MM-dd HH:mm'))}`,
    '',
    'Summary',
    `Total shift hours,${report.totalShiftHours.toFixed(2)}`,
    `Total shifts,${report.totalShifts}`,
    `Total notes,${report.totalNotes}`,
    `Total tasks,${report.totalTasks}`,
    `Unassigned shifts,${report.unassignedShifts}`,
    '',
    'Person,Role,Shift hours,Shifts,Notes,Tasks',
  ]

  for (const row of report.personnelRows) {
    lines.push(
      [
        escapeCsvCell(row.fullName),
        escapeCsvCell(row.companyRoleName),
        row.shiftHours.toFixed(2),
        row.shiftCount,
        row.noteCount,
        row.taskCount,
      ].join(','),
    )
  }

  lines.push('', 'Role,Personnel count,Shift hours')
  for (const row of report.roleHours) {
    lines.push(
      [escapeCsvCell(row.roleName), row.personnelCount, row.hours.toFixed(2)].join(','),
    )
  }

  lines.push('', 'Date,Shift hours,Shifts')
  for (const row of report.dailyShiftHours) {
    if (row.shiftCount === 0) continue
    lines.push([row.date, row.hours.toFixed(2), row.shiftCount].join(','))
  }

  return `${lines.join('\n')}\n`
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadStatsCsv(report: WorkspaceStatsReport, organizationName: string) {
  const safeOrg = organizationName.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'workspace'
  const filename = `mnemonotes-stats_${safeOrg}_${format(new Date(), 'yyyy-MM-dd')}.csv`
  downloadTextFile(filename, buildStatsCsv(report, organizationName), 'text/csv;charset=utf-8')
}
