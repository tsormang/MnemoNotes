import {
  Bell,
  CalendarDays,
  ClipboardList,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { Modal } from './components/Modal'
import { AdminConsole } from './features/admin/AdminConsole'
import { AcceptInviteScreen, LoginScreen, SignOutButton } from './features/auth/AuthScreens'
import {
  RedirectIfAuthenticated,
  RequireAuditAccess,
  RequireAuth,
  RequirePeopleAccess,
  RequirePlatformAdmin,
} from './features/auth/RouteGuards'
import { useWorkspace, useCan } from './features/auth/WorkspaceProvider'
import { usePersonnelList } from './lib/queries/workspace'
import { NotificationsPanel } from './features/calendar/NotificationsPanel'
import { CalendarEventModal } from './features/calendar/CalendarEventModal'
import { CalendarShellProvider, useCalendarShell } from './features/calendar/CalendarShellContext'
import { PharmacyCalendar } from './features/calendar/PharmacyCalendar'
import { PeopleScreen } from './features/people/PeopleScreen'
import { AuditLogScreen } from './features/audit/AuditLogScreen'
import { UserSecurityScreen } from './features/settings/UserSecurityScreen'

type ShellModal = 'search' | 'security' | 'notifications' | null

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginScreen />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/accept-invite" element={<AcceptInviteScreen />} />
      <Route path="/register-owner" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAuth />}>
        <Route
          path="/app"
          element={
            <CalendarShellProvider>
              <AppShell />
            </CalendarShellProvider>
          }
        >
          <Route index element={<Navigate to="/app/calendar" replace />} />
          <Route path="calendar" element={<PharmacyCalendar />} />
          <Route
            path="people"
            element={
              <RequirePeopleAccess>
                <PeopleScreen />
              </RequirePeopleAccess>
            }
          />
          <Route
            path="audit"
            element={
              <RequireAuditAccess>
                <AuditLogScreen />
              </RequireAuditAccess>
            }
          />
          <Route path="settings/users" element={<Navigate to="/app/calendar" replace />} />
        </Route>
      </Route>
      <Route element={<RequirePlatformAdmin />}>
        <Route path="/admin" element={<AdminConsole />} />
      </Route>
      <Route path="*" element={<Navigate to="/app/calendar" replace />} />
    </Routes>
  )
}

function AppShell() {
  const [openModal, setOpenModal] = useState<ShellModal>(null)
  const closeModal = useCallback(() => setOpenModal(null), [])
  const { membership, isOwner } = useWorkspace()
  const canManagePersonnel = useCan('personnel.manage')
  const canManageRoles = useCan('roles.manage')
  const canReadAudit = useCan('audit.read')
  const showPeopleLink = isOwner || canManagePersonnel || canManageRoles
  const showSecondaryNav = showPeopleLink || canReadAudit
  const {
    searchQuery,
    setSearchQuery,
    kindFilter,
    setKindFilter,
    personnelFilterId,
    setPersonnelFilterId,
    openCreateEvent,
  } = useCalendarShell()
  const { organizationId } = useWorkspace()
  const personnelQuery = usePersonnelList(organizationId)
  const canCreateEvents = useCan('shifts.create') || useCan('notes.create')

  return (
    <div className="app-shell">
      <header className="app-bar">
        <NavLink className="brand" to="/app/calendar">
          <div className="brand-mark">
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <div>
            <strong className="brand-name">MnemoNotes</strong>
            {membership ? <span className="brand-subtitle">{membership.organizationName}</span> : null}
          </div>
        </NavLink>

        <nav className="app-bar-actions" aria-label="App actions">
          {showSecondaryNav ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/calendar"
              aria-label="Calendar"
            >
              <CalendarDays size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          <button
            className="icon-ghost"
            type="button"
            aria-label="Search"
            onClick={() => setOpenModal('search')}
          >
            <Search size={19} aria-hidden="true" />
          </button>
          {showPeopleLink ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/people"
              aria-label="Personnel and roles"
            >
              <Users size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          {canReadAudit ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/audit"
              aria-label="Audit log"
            >
              <ClipboardList size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          <button
            className="icon-ghost"
            type="button"
            aria-label="Configuration"
            onClick={() => setOpenModal('security')}
          >
            <Settings size={19} aria-hidden="true" />
          </button>
          <button
            className="icon-ghost"
            type="button"
            aria-label="Notifications"
            onClick={() => setOpenModal('notifications')}
          >
            <Bell size={19} aria-hidden="true" />
          </button>
          <button
            className="icon-primary"
            type="button"
            aria-label="Create event"
            disabled={!canCreateEvents}
            onClick={() => {
              closeModal()
              openCreateEvent()
            }}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          <SignOutButton />
        </nav>
      </header>

      <main className="main-surface">
        <Outlet />
      </main>

      <Modal open={openModal === 'search'} onClose={closeModal} title="Search & filter">
        <label className="search-field">
          <span className="visually-hidden">Search calendar</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search shifts, notes, tasks…"
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <div className="filter-row">
          <label>
            Type
            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as typeof kindFilter)
              }
            >
              <option value="all">All types</option>
              <option value="shift">Shifts</option>
              <option value="note">Notes</option>
              <option value="task">Tasks</option>
            </select>
          </label>

          <label>
            Staff
            <select
              value={personnelFilterId ?? ''}
              onChange={(event) =>
                setPersonnelFilterId(event.target.value ? event.target.value : null)
              }
            >
              <option value="">Anyone</option>
              {(personnelQuery.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="modal-hint">Filters apply to the calendar immediately.</p>
      </Modal>

      <Modal open={openModal === 'security'} onClose={closeModal} title="Configuration" wide>
        <UserSecurityScreen />
      </Modal>

      <Modal
        open={openModal === 'notifications'}
        onClose={closeModal}
        title="Notifications"
        variant="panel"
      >
        <NotificationsPanel />
      </Modal>

      <CalendarEventModal />
    </div>
  )
}

export default App
