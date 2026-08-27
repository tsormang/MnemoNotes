import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogIn,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { AcceptInviteScreen, LoginScreen, OwnerRegisterScreen } from './features/auth/AuthScreens'
import { PharmacyCalendar } from './features/calendar/PharmacyCalendar'
import { PeopleScreen } from './features/people/PeopleScreen'
import { UserSecurityScreen } from './features/settings/UserSecurityScreen'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/register-owner" element={<OwnerRegisterScreen />} />
      <Route path="/accept-invite" element={<AcceptInviteScreen />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/calendar" replace />} />
        <Route path="calendar" element={<PharmacyCalendar />} />
        <Route path="people" element={<PeopleScreen />} />
        <Route path="settings/users" element={<UserSecurityScreen />} />
      </Route>
      <Route path="/admin" element={<DeveloperAdminScreen />} />
      <Route path="*" element={<Navigate to="/app/calendar" replace />} />
    </Routes>
  )
}

function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={22} aria-hidden="true" />
          </div>
          <div>
            <strong>MnemoNotes</strong>
            <span>Pharmacy OS</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          <NavLink to="/app/calendar">
            <LayoutDashboard size={18} aria-hidden="true" />
            Calendar
          </NavLink>
          <NavLink to="/app/people">
            <Users size={18} aria-hidden="true" />
            People
          </NavLink>
          <NavLink to="/app/settings/users">
            <Settings size={18} aria-hidden="true" />
            Security
          </NavLink>
          <NavLink to="/login">
            <LogIn size={18} aria-hidden="true" />
            Login
          </NavLink>
        </nav>
      </aside>

      <main className="main-surface">
        <header className="topbar">
          <div>
            <p className="eyebrow">Expansion-ready scheduling</p>
            <strong>Pharmacy-first, multi-business later</strong>
          </div>
          <button className="icon-only" type="button" aria-label="Notifications">
            <Bell size={19} aria-hidden="true" />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}

function DeveloperAdminScreen() {
  return (
    <main className="admin-page">
      <section className="admin-card">
        <Shield size={28} aria-hidden="true" />
        <h1>Developer Admin</h1>
        <p>
          This area is reserved for platform operators. Accounts should be seeded manually,
          protected with MFA, and audited on every support action.
        </p>
      </section>
    </main>
  )
}

export default App
