import {
  Bell,
  CalendarDays,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { Modal } from './components/Modal'
import { AdminConsole } from './features/admin/AdminConsole'
import { AcceptInviteScreen, LoginScreen, OwnerRegisterScreen } from './features/auth/AuthScreens'
import { NotificationsPanel } from './features/calendar/NotificationsPanel'
import { PharmacyCalendar } from './features/calendar/PharmacyCalendar'
import { PeopleScreen } from './features/people/PeopleScreen'
import { UserSecurityScreen } from './features/settings/UserSecurityScreen'

type ShellModal = 'search' | 'people' | 'security' | 'notifications' | 'create' | null

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/register-owner" element={<OwnerRegisterScreen />} />
      <Route path="/accept-invite" element={<AcceptInviteScreen />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/calendar" replace />} />
        <Route path="calendar" element={<PharmacyCalendar />} />
        <Route path="people" element={<Navigate to="/app/calendar" replace />} />
        <Route path="settings/users" element={<Navigate to="/app/calendar" replace />} />
      </Route>
      <Route path="/admin" element={<AdminConsole />} />
      <Route path="*" element={<Navigate to="/app/calendar" replace />} />
    </Routes>
  )
}

function AppShell() {
  const [openModal, setOpenModal] = useState<ShellModal>(null)
  const closeModal = useCallback(() => setOpenModal(null), [])

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <strong className="brand-name">MnemoNotes</strong>
        </div>

        <nav className="app-bar-actions" aria-label="App actions">
          <button
            className="icon-ghost"
            type="button"
            aria-label="Search"
            onClick={() => setOpenModal('search')}
          >
            <Search size={19} aria-hidden="true" />
          </button>
          <button
            className="icon-ghost"
            type="button"
            aria-label="People"
            onClick={() => setOpenModal('people')}
          >
            <Users size={19} aria-hidden="true" />
          </button>
          <button
            className="icon-ghost"
            type="button"
            aria-label="Security"
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
            onClick={() => setOpenModal('create')}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </nav>
      </header>

      <main className="main-surface">
        <Outlet />
      </main>

      <Modal open={openModal === 'search'} onClose={closeModal} title="Search">
        <label className="search-field">
          <span className="visually-hidden">Search calendar</span>
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Search shifts, notes, tasks…" autoFocus />
        </label>
        <p className="modal-hint">Search will filter calendar items once data is wired.</p>
      </Modal>

      <Modal open={openModal === 'people'} onClose={closeModal} title="People" wide>
        <PeopleScreen />
      </Modal>

      <Modal open={openModal === 'security'} onClose={closeModal} title="Security" wide>
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

      <Modal open={openModal === 'create'} onClose={closeModal} title="Create event">
        <form className="create-event-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Title
            <input type="text" placeholder="Morning shift, stock note…" />
          </label>
          <label>
            Type
            <select defaultValue="shift">
              <option value="shift">Shift</option>
              <option value="note">Note</option>
              <option value="task">Task</option>
            </select>
          </label>
          <label>
            Starts
            <input type="datetime-local" />
          </label>
          <label>
            Ends
            <input type="datetime-local" />
          </label>
          <button className="icon-button" type="submit">
            Save event
          </button>
        </form>
      </Modal>
    </div>
  )
}

export default App
