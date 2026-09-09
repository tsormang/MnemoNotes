import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  Download,
  Printer,
  Table2,
  Users,
} from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { useCalendarItems, useCompanyRoles, usePersonnelList } from '../../lib/queries/workspace'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { buildWorkspaceStatsReport } from '../../lib/stats/aggregate'
import { filterVisibleCalendarItems } from '../../lib/display-preferences'
import { downloadStatsCsv } from '../../lib/stats/export'
import { formatStatsRangeLabel, resolveStatsRange, type StatsRangePreset } from '../../lib/stats/range'
import { personnelInitials, shouldUsePersonnelInitials } from '../../lib/icons/fallback-catalog'
import { resolveEntityColors } from '../../lib/entity-colors'
import { useIconCatalog } from '../../lib/queries/icons'
import { useDisplayPreferences } from '../../store/display-preferences'
import { useStatsUiStore, type StatsTab } from '../../store/stats-ui'
import { StatsBarChart } from './StatsBarChart'
import { StatsPrintPreview } from './StatsPrintPreview'

interface StatsPanelProps {
  onDrillDown?: (input: { personnelId: string; fullName: string }) => void
}

const STATS_TABS: {
  id: StatsTab
  label: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
}[] = [
  { id: 'overview', label: 'Period', icon: CalendarRange },
  { id: 'person', label: 'Hours by person', icon: Users },
  { id: 'daily', label: 'Daily shift hours', icon: CalendarDays },
  { id: 'role', label: 'Hours by role', icon: Briefcase },
  { id: 'detail', label: 'Personnel detail', icon: Table2 },
  { id: 'export', label: 'Export', icon: Printer },
]

function formatHours(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

export function StatsPanel({ onDrillDown }: StatsPanelProps) {
  const { organizationId, membership } = useWorkspace()
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const rolesQuery = useCompanyRoles(organizationId)
  const { resolvePath } = useIconCatalog()
  const showTasks = useDisplayPreferences((state) => state.showTasks)
  const activeTab = useStatsUiStore((state) => state.activeTab)
  const setActiveTab = useStatsUiStore((state) => state.setActiveTab)

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
      companyRoleId: person.companyRoleId,
      iconId: person.iconId,
      avatarGender: person.avatarGender,
      colorKey: person.colorKey,
    }))

    const roles = (rolesQuery.data ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      iconId: role.iconId,
      colorKey: role.colorKey,
    }))

    return buildWorkspaceStatsReport({
      range,
      rangeLabel: formatStatsRangeLabel(range),
      items: filterVisibleCalendarItems(calendarQuery.data ?? [], showTasks),
      personnel,
      roles,
    })
  }, [calendarQuery.data, personnelQuery.data, range, rolesQuery.data, showTasks])

  const personLabelIcons = useMemo(() => {
    if (!report) return []
    return report.personnelRows.map((row) => {
      const initials = personnelInitials(row.fullName)
      if (shouldUsePersonnelInitials(row.iconId)) {
        return { initials }
      }
      return {
        imageUrl: resolvePath(row.iconId, 'personnel', row.avatarGender),
        initials,
      }
    })
  }, [report, resolvePath])

  const roleLabelIcons = useMemo(() => {
    if (!report) return []
    return report.roleHours.map((row) => ({
      imageUrl: resolvePath(row.iconId, 'company_role'),
      initials: personnelInitials(row.roleName),
    }))
  }, [report, resolvePath])

  const loading = calendarQuery.isLoading || personnelQuery.isLoading
  const statsReady = Boolean(range && report)

  const handleExportCsv = () => {
    if (!report) return
    downloadStatsCsv(report, membership?.organizationName ?? 'Workspace')
  }

  return (
    <div className="stats-panel">
      <div className="stats-tabs" role="tablist" aria-label="Workforce statistics sections">
        {STATS_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="stats-tab"
              aria-selected={activeTab === tab.id}
              aria-label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="stats-tab-label">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div className="stats-tab-panel" role="tabpanel">
        {activeTab === 'overview' ? (
          <>
            <div className="stats-overview-controls">
              <label className="stats-period-field">
                Period
                <select
                  className="form-select"
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
                <div className="stats-range-controls">
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
                </div>
              ) : null}
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
                {showTasks ? (
                  <article className="stats-summary-card">
                    <span>Tasks</span>
                    <strong>{report.totalTasks}</strong>
                  </article>
                ) : null}
                <article className="stats-summary-card stats-summary-card--warn">
                  <span>Unassigned shifts</span>
                  <strong>{report.unassignedShifts}</strong>
                </article>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === 'person' ? (
          <section className="stats-section">
            <h3>Hours by person</h3>
            {!range ? (
              <p className="modal-hint">Select a period on the Period tab first.</p>
            ) : loading ? (
              <p className="modal-hint">Loading workforce data…</p>
            ) : !report || report.personnelRows.length === 0 ? (
              <p className="modal-hint">No scheduled activity in this period.</p>
            ) : (
              <StatsBarChart
                labels={report.personnelRows.map((row) => row.fullName)}
                values={report.personnelRows.map((row) => row.shiftHours)}
                barColors={report.personnelRows.map(
                  (row) => resolveEntityColors(row.colorKey).border,
                )}
                orientation="horizontal"
                ariaLabel="Shift hours by person"
                labelIcons={personLabelIcons}
                onBarClick={
                  onDrillDown
                    ? (index) => {
                        const row = report.personnelRows[index]
                        if (!row) return
                        onDrillDown({ personnelId: row.personnelId, fullName: row.fullName })
                      }
                    : undefined
                }
              />
            )}
          </section>
        ) : null}

        {activeTab === 'daily' ? (
          <section className="stats-section">
            <h3>Daily shift hours</h3>
            {!range ? (
              <p className="modal-hint">Select a period on the Period tab first.</p>
            ) : loading ? (
              <p className="modal-hint">Loading workforce data…</p>
            ) : !report ? (
              <p className="modal-hint">No scheduled activity in this period.</p>
            ) : (
              <StatsBarChart
                labels={report.dailyShiftHours.map((row) => row.date)}
                values={report.dailyShiftHours.map((row) => row.hours)}
                colorVar="--event-shift-border"
                orientation="vertical"
                ariaLabel="Daily shift hours"
              />
            )}
          </section>
        ) : null}

        {activeTab === 'role' ? (
          <section className="stats-section">
            <h3>Hours by role</h3>
            {!range ? (
              <p className="modal-hint">Select a period on the Period tab first.</p>
            ) : loading ? (
              <p className="modal-hint">Loading workforce data…</p>
            ) : !report || report.roleHours.length === 0 ? (
              <p className="modal-hint">No role breakdown for this period.</p>
            ) : (
              <StatsBarChart
                labels={report.roleHours.map((row) => row.roleName)}
                values={report.roleHours.map((row) => row.hours)}
                barColors={report.roleHours.map((row) => resolveEntityColors(row.colorKey).border)}
                orientation="horizontal"
                ariaLabel="Shift hours by role"
                labelIcons={roleLabelIcons}
              />
            )}
          </section>
        ) : null}

        {activeTab === 'detail' ? (
          <section className="stats-section">
            <h3>Personnel detail</h3>
            {!range ? (
              <p className="modal-hint">Select a period on the Period tab first.</p>
            ) : loading ? (
              <p className="modal-hint">Loading workforce data…</p>
            ) : !report ? (
              <p className="modal-hint">No scheduled activity in this period.</p>
            ) : (
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Shift h</th>
                      <th>Shifts</th>
                      <th>Notes</th>
                      {showTasks ? <th>Tasks</th> : null}
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
                        {showTasks ? <td>{row.taskCount}</td> : null}
                        <td>
                          {onDrillDown ? (
                            <button
                              type="button"
                              className="stats-drill-button"
                              onClick={() =>
                                onDrillDown({ personnelId: row.personnelId, fullName: row.fullName })
                              }
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
            )}
          </section>
        ) : null}

        {activeTab === 'export' ? (
          <section className="stats-section">
            <h3>Export</h3>
            {!range ? (
              <p className="modal-hint">Select a period on the Period tab first.</p>
            ) : loading ? (
              <p className="modal-hint">Loading workforce data…</p>
            ) : !statsReady ? (
              <p className="modal-hint">Statistics are not ready to export yet.</p>
            ) : (
              <>
                <p className="modal-hint">Download the current period as a spreadsheet or printable PDF.</p>
                <div className="stats-export-actions">
                  <button type="button" className="icon-button" onClick={handleExportCsv}>
                    <Download size={16} aria-hidden="true" />
                    CSV
                  </button>
                  <button type="button" className="icon-button" onClick={() => setPrintOpen(true)}>
                    <Printer size={16} aria-hidden="true" />
                    PDF
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

      {report ? (
        <StatsPrintPreview
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          organizationName={membership?.organizationName ?? 'Workspace'}
          report={report}
          showTasks={showTasks}
        />
      ) : null}
    </div>
  )
}
