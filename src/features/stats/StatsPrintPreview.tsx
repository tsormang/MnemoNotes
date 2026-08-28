import { Printer } from 'lucide-react'
import { Modal } from '../../components/Modal'
import type { WorkspaceStatsReport } from '../../lib/stats/aggregate'

interface StatsPrintPreviewProps {
  open: boolean
  onClose: () => void
  organizationName: string
  report: WorkspaceStatsReport
}

function formatHours(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

export function StatsPrintPreview({
  open,
  onClose,
  organizationName,
  report,
}: StatsPrintPreviewProps) {
  const handlePrint = () => {
    document.body.classList.add('stats-print-mode')
    const cleanup = () => {
      document.body.classList.remove('stats-print-mode')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  return (
    <Modal open={open} onClose={onClose} title="Statistics report" wide>
      <div className="stats-print-root">
        <header className="stats-print-header">
          <h3>{organizationName}</h3>
          <p>Workforce statistics · {report.rangeLabel}</p>
        </header>

        <section className="stats-print-summary">
          <div>
            <span>Shift hours</span>
            <strong>{formatHours(report.totalShiftHours)}</strong>
          </div>
          <div>
            <span>Shifts</span>
            <strong>{report.totalShifts}</strong>
          </div>
          <div>
            <span>Notes</span>
            <strong>{report.totalNotes}</strong>
          </div>
          <div>
            <span>Tasks</span>
            <strong>{report.totalTasks}</strong>
          </div>
          <div>
            <span>Unassigned</span>
            <strong>{report.unassignedShifts}</strong>
          </div>
        </section>

        <section>
          <h4>Hours by person</h4>
          <table className="stats-table stats-table--print">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Shift h</th>
                <th>Shifts</th>
                <th>Notes</th>
                <th>Tasks</th>
              </tr>
            </thead>
            <tbody>
              {report.personnelRows.map((row) => (
                <tr key={row.personnelId}>
                  <td>{row.fullName}</td>
                  <td>{row.companyRoleName}</td>
                  <td>{formatHours(row.shiftHours)}</td>
                  <td>{row.shiftCount}</td>
                  <td>{row.noteCount}</td>
                  <td>{row.taskCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h4>Hours by role</h4>
          <table className="stats-table stats-table--print">
            <thead>
              <tr>
                <th>Role</th>
                <th>People</th>
                <th>Shift hours</th>
              </tr>
            </thead>
            <tbody>
              {report.roleHours.map((row) => (
                <tr key={row.roleName}>
                  <td>{row.roleName}</td>
                  <td>{row.personnelCount}</td>
                  <td>{formatHours(row.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="form-actions print-preview-actions">
        <button type="button" className="icon-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="icon-button" onClick={handlePrint}>
          <Printer size={16} aria-hidden="true" />
          Print / Save PDF
        </button>
      </div>
    </Modal>
  )
}
