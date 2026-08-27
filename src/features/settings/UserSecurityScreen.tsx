import { roleLabels, rolePermissions } from '../../lib/access-control'
import type { AppRole } from '../../types/domain'

const roles = Object.keys(rolePermissions) as AppRole[]

export function UserSecurityScreen() {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Security</p>
          <h1>Roles and permissions</h1>
        </div>
      </div>

      <div className="role-grid">
        {roles.map((role) => (
          <article className="role-card" key={role}>
            <h2>{roleLabels[role]}</h2>
            <p>{rolePermissions[role].length} permissions</p>
            <ul>
              {rolePermissions[role].slice(0, 8).map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
