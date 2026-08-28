import { useWorkspace } from '../auth/WorkspaceProvider'
import { useCompanyRoles } from '../../lib/queries/workspace'
import { WorkingDaySettings } from './WorkingDaySettings'

export function UserSecurityScreen() {
  const { organizationId } = useWorkspace()
  const rolesQuery = useCompanyRoles(organizationId)

  return (
    <section className="content-section content-section--embedded">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Workspace and security</h1>
        </div>
      </div>

      <WorkingDaySettings compact />

      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">Security</p>
          <h2 className="settings-subheading">Company roles and permissions</h2>
        </div>
      </div>

      <div className="role-grid">
        {(rolesQuery.data ?? []).map((role) => (
          <article className="role-card" key={role.id}>
            <h2>{role.name}</h2>
            <p>{role.permissions.length} permissions</p>
            <ul>
              {role.permissions.slice(0, 8).map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
