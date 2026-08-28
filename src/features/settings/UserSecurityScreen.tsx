import { Link } from 'react-router-dom'
import { useCan } from '../auth/WorkspaceProvider'
import { WorkingDaySettings } from './WorkingDaySettings'

export function UserSecurityScreen() {
  const canManageRoles = useCan('roles.manage')

  return (
    <section className="content-section content-section--embedded">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Workspace settings</h1>
        </div>
      </div>

      <WorkingDaySettings compact />

      {canManageRoles ? (
        <p className="modal-hint">
          Company roles and permissions are managed on the{' '}
          <Link to="/app/people">Personnel &amp; roles</Link> page.
        </p>
      ) : null}
    </section>
  )
}
