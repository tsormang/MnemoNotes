import { format } from 'date-fns'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { formatAuditAction, formatAuditEntityTable } from '../../lib/audit-labels'
import { useAuditLog } from '../../lib/queries/audit'
import type { AuditLogEntry } from '../../types/domain'

function formatPayload(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = entry.before != null || entry.after != null

  return (
    <>
      <tr className="audit-row">
        <td>
          <time dateTime={entry.createdAt}>
            {format(new Date(entry.createdAt), 'dd MMM yyyy, HH:mm')}
          </time>
        </td>
        <td>{formatAuditAction(entry.action)}</td>
        <td>{entry.actorName ?? 'System'}</td>
        <td>{formatAuditEntityTable(entry.entityTable)}</td>
        <td className="audit-cell-id">{entry.entityId ?? '—'}</td>
        <td>
          {hasDetails ? (
            <button
              type="button"
              className="audit-expand-btn"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              Details
            </button>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {expanded && hasDetails ? (
        <tr className="audit-row-details">
          <td colSpan={6}>
            <div className="audit-details-grid">
              {entry.before != null ? (
                <div>
                  <p className="eyebrow">Before</p>
                  <pre>{formatPayload(entry.before)}</pre>
                </div>
              ) : null}
              {entry.after != null ? (
                <div>
                  <p className="eyebrow">After</p>
                  <pre>{formatPayload(entry.after)}</pre>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function AuditLogScreen() {
  const { organizationId, membership } = useWorkspace()
  const auditQuery = useAuditLog(organizationId)
  const entries = auditQuery.data ?? []

  return (
    <section className="content-section audit-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>Audit log</h1>
          {membership ? (
            <p className="page-hint page-hint--flush">
              Recent activity for {membership.organizationName}. Showing the latest 100 entries.
            </p>
          ) : null}
        </div>
      </div>

      <div className="admin-list-panel audit-panel">
        <div className="admin-list-header">
          <div>
            <h2>Workspace activity</h2>
            <p>Provisioning, invites, and other trusted server actions recorded for your organization.</p>
          </div>
        </div>

        <div className="admin-table-shell">
          {auditQuery.isLoading ? <p className="page-hint">Loading audit log…</p> : null}
          {auditQuery.isError ? (
            <p className="field-error page-hint">Could not load audit log. Try again shortly.</p>
          ) : null}

          {!auditQuery.isLoading && entries.length === 0 ? (
            <p className="page-hint">No audit entries yet for this workspace.</p>
          ) : null}

          {entries.length > 0 ? (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Record</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </section>
  )
}
