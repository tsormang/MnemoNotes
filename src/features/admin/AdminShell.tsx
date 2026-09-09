import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { DevVersionLabel } from '../../components/DevVersionLabel'
import { usePendingRegistrationCount } from '../../lib/queries/workspace'
import { SignOutButton } from '../auth/AuthScreens'

export function AdminShell({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) {
  const pendingCountQuery = usePendingRegistrationCount()
  const pendingCount = pendingCountQuery.data ?? 0

  return (
    <main className="admin-console">
      <header className="admin-topbar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-title-row">
              <strong className="brand-name">MnemoNotes Admin</strong>
              <DevVersionLabel />
            </div>
            <span className="brand-subtitle">Platform company management</span>
          </div>
        </div>
        <nav className="admin-topbar-nav" aria-label="Admin sections">
          <NavLink className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')} to="/admin" end>
            Companies
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')}
            to="/admin/approvals"
          >
            Approvals
            {pendingCount > 0 ? <span className="admin-pending-badge">{pendingCount}</span> : null}
          </NavLink>
        </nav>
        <div className="admin-topbar-actions">
          <SignOutButton />
        </div>
      </header>

      <section className="admin-hero">
        <div>
          <p className="eyebrow">Platform Admin</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      {children}
    </main>
  )
}
