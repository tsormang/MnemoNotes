import { Download, ExternalLink, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCalendarItems, usePersonnelList } from '../../lib/queries/workspace'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { buildWorkspaceStatsReport } from '../../lib/stats/aggregate'
import { downloadStatsCsv } from '../../lib/stats/export'
import { formatStatsRangeLabel, resolveStatsRange, type StatsRangePreset } from '../../lib/stats/range'
import { StatsPrintPreview } from './StatsPrintPreview'

interface StatsPanelProps {
  onDrillDown?: (input: { personnelId: string; fullName: string }) => void
}

function formatHours(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

export function StatsPanel({ onDrillDown }: StatsPanelProps) {
  const { organizationId, membership } = useWorkspace()
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)

  const [preset, setPreset] = useState<StatsRangePreset>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [printOpen, setPrintOpen] = useState(false)

  const range = useMemo(
    () => resolveStatsRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  )

  const report = useMemo(() => {
    if (!range) return null

    const personnel = (personnelQuery.data ?? []).map((person) => ({
      id: person.id,
      fullName: person.fullName,
      companyRoleName: person.companyRoleName,
    }))

    return buildWorkspaceStatsReport({
      range,
      rangeLabel: formatStatsRangeLabel(range),
      items: calendarQuery.data ?? [],
      personnel,
    })
  }, [calendarQuery.data, personnelQuery.data, range])

  const maxPersonHours = Math.max(...(report?.personnelRows ?? []).map((row) => row.shiftHours), 1)
  const maxDailyHours = Math.max(...(report?.dailyShiftHours ?? []).map((row) => row.hours), 1)
  const maxRoleHours = Math.max(...(report?.roleHours ?? []).map((row) => row.hours), 1)
  const loading = calendarQuery.isLoading || personnelQuery.isLoading
  const statsReady = Boolean(range && report)

  const handleExportCsv = () => {
    if (!report) return
    downloadStatsCsv(report, membership?.organizationName ?? 'Workspace')
  }

  return (
    <div className="stats-panel">
      <div className="stats-toolbar">
        <div className="stats-range-controls">
          <label>
            Period
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as StatsRangePreset)}
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="last30">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

          {preset === 'custom' ? (
            <>
              <label>
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="stats-export-actions">
          <button type="button" className="icon-button" onClick={handleExportCsv} disabled={loading || !statsReady}>
            <Download size={16} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPrintOpen(true)}
            disabled={loading || !statsReady}
          >
            <Printer size={16} aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      <p className="stats-range-label">
        {range ? formatStatsRangeLabel(range) : 'Custom range'}
      </p>

      {!range ? (
        <p className="modal-hint">Select a start and end date to view statistics.</p>
      ) : loading ? (
        <p className="modal-hint">Loading workforce data…</p>
      ) : null}

      {statsReady && report ? (
        <>
      <div className="stats-summary-grid">
        <article className="stats-summary-card">
          <span>Shift hours</span>
          <strong>{formatHours(report.totalShiftHours)}</strong>
        </article>
        <article className="stats-summary-card">
          <span>Shifts</span>
          <strong>{report.totalShifts}</strong>
        </article>
        <article className="stats-summary-card">
          <span>Notes</span>
          <strong>{report.totalNotes}</strong>
        </article>
        <article className="stats-summary-card">
          <span>Tasks</span>
          <strong>{report.totalTasks}</strong>
        </article>
        <article className="stats-summary-card stats-summary-card--warn">
          <span>Unassigned shifts</span>
          <strong>{report.unassignedShifts}</strong>
        </article>
      </div>

      <section className="stats-section">
        <h3>Hours by person</h3>
        {report.personnelRows.length === 0 ? (
          <p className="modal-hint">No scheduled activity in this period.</p>
        ) : (
          <ul className="stats-bar-chart" aria-label="Shift hours by person">
            {report.personnelRows.map((row) => (
              <li key={row.personnelId} className="stats-bar-row">
                <div className="stats-bar-label">
                  <span>{row.fullName}</span>
                  <small>{row.companyRoleName}</small>
                </div>
                <div className="stats-bar-track" aria-hidden="true">
                  <span
                    className="stats-bar-fill"
                    style={{ width: `${(row.shiftHours / maxPersonHours) * 100}%` }}
                  />
                </div>
                <div className="stats-bar-value">{formatHours(row.shiftHours)}h</div>
                {onDrillDown ? (
                  <button
                    type="button"
                    className="stats-drill-button"
                    aria-label={`View ${row.fullName} on calendar`}
                    onClick={() => onDrillDown({ personnelId: row.personnelId, fullName: row.fullName })}
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stats-section">
        <h3>Daily shift hours</h3>
        <ul className="stats-bar-chart stats-bar-chart--compact" aria-label="Daily shift hours">
          {report.dailyShiftHours.map((row) => (
            <li key={row.date} className="stats-bar-row">
              <div className="stats-bar-label">
                <span>{row.date}</span>
                <small>{row.shiftCount} shifts</small>
              </div>
              <div className="stats-bar-track" aria-hidden="true">
                <span
                  className="stats-bar-fill stats-bar-fill--daily"
                  style={{ width: `${(row.hours / maxDailyHours) * 100}%` }}
                />
              </div>
              <div className="stats-bar-value">{formatHours(row.hours)}h</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="stats-section">
        <h3>Hours by role</h3>
        {report.roleHours.length === 0 ? (
          <p className="modal-hint">No role breakdown for this period.</p>
        ) : (
          <ul className="stats-bar-chart" aria-label="Shift hours by role">
            {report.roleHours.map((row) => (
              <li key={row.roleName} className="stats-bar-row">
                <div className="stats-bar-label">
                  <span>{row.roleName}</span>
                  <small>{row.personnelCount} people</small>
                </div>
                <div className="stats-bar-track" aria-hidden="true">
                  <span
                    className="stats-bar-fill stats-bar-fill--role"
                    style={{ width: `${(row.hours / maxRoleHours) * 100}%` }}
                  />
                </div>
                <div className="stats-bar-value">{formatHours(row.hours)}h</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stats-section">
        <h3>Personnel detail</h3>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Shift h</th>
                <th>Shifts</th>
                <th>Notes</th>
                <th>Tasks</th>
                <th aria-label="Actions" />
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
                  <td>
                    {onDrillDown ? (
                      <button
                        type="button"
                        className="stats-drill-button"
                        onClick={() => onDrillDown({ personnelId: row.personnelId, fullName: row.fullName })}
                      >
                        Calendar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : null}

      {report ? (
        <StatsPrintPreview
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          organizationName={membership?.organizationName ?? 'Workspace'}
          report={report}
        />
      ) : null}
    </div>
  )
}
