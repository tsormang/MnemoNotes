import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { AppBarActions } from './components/AppBarActions'
import { BrandMark } from './components/BrandMark'
import { DevVersionLabel } from './components/DevVersionLabel'
import { Modal } from './components/Modal'
import { AdminConsole } from './features/admin/AdminConsole'
import { AcceptInviteScreen, LoginScreen } from './features/auth/AuthScreens'
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
import { NotificationProvider, useNotifications } from './features/notifications/NotificationProvider'
import { PeopleScreen } from './features/people/PeopleScreen'
import { AuditLogScreen } from './features/audit/AuditLogScreen'
import { UserSecurityScreen } from './features/settings/UserSecurityScreen'
import { StatsPanel } from './features/stats/StatsPanel'
import { useDisplayPreferences } from './store/display-preferences'

type ShellModal = 'search' | 'security' | 'notifications' | 'stats' | null

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
              <NotificationProvider>
                <AppShell />
              </NotificationProvider>
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
  const { t } = useTranslation(['common', 'notifications'])
  const navigate = useNavigate()
  const [openModal, setOpenModal] = useState<ShellModal>(null)
  const closeModal = useCallback(() => setOpenModal(null), [])
  const { membership, isOwner } = useWorkspace()
  const canManagePersonnel = useCan('personnel.manage')
  const canManageRoles = useCan('roles.manage')
  const canReadAudit = useCan('audit.read')
  const canReadStats = useCan('stats.read')
  const showPeopleLink = isOwner || canManagePersonnel || canManageRoles
  const showSecondaryNav = showPeopleLink || canReadAudit
  const {
    searchQuery,
    setSearchQuery,
    kindFilter,
    setKindFilter,
    personnelFilterId,
    setPersonnelFilterId,
  } = useCalendarShell()
  const { organizationId } = useWorkspace()
  const personnelQuery = usePersonnelList(organizationId)
  const showTasks = useDisplayPreferences((state) => state.showTasks)

  const { badgeCount } = useNotifications()

  useEffect(() => {
    if (!showTasks && kindFilter === 'task') {
      setKindFilter('all')
    }
  }, [kindFilter, setKindFilter, showTasks])

  const openShellModal = useCallback((modal: Exclude<ShellModal, null>) => {
    setOpenModal(modal)
  }, [])

  const handleStatsDrillDown = useCallback(
    ({ personnelId }: { personnelId: string; fullName: string }) => {
      setPersonnelFilterId(personnelId)
      setKindFilter('shift')
      closeModal()
      navigate('/app/calendar')
    },
    [closeModal, navigate, setKindFilter, setPersonnelFilterId],
  )

  return (
    <div className="app-shell">
      <header className="app-bar">
        <NavLink className="brand" to="/app/calendar">
          <BrandMark />
          <div>
            <div className="brand-title-row">
              <strong className="brand-name">MnemoNotes</strong>
              <DevVersionLabel />
            </div>
            {membership ? <span className="brand-subtitle">{membership.workspaceLabel}</span> : null}
          </div>
        </NavLink>

        <AppBarActions
          showSecondaryNav={showSecondaryNav}
          showPeopleLink={showPeopleLink}
          canReadAudit={canReadAudit}
          canReadStats={canReadStats}
          badgeCount={badgeCount}
          notificationsOpen={openModal === 'notifications'}
          onOpenModal={openShellModal}
        />
      </header>

      <main className="main-surface">
        <Outlet />
      </main>

      <Modal open={openModal === 'search'} onClose={closeModal} title={t('common:nav.searchFilter')}>
        <label className="search-field">
          <span className="visually-hidden">{t('common:filter.searchCalendar')}</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('common:filter.searchPlaceholder')}
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <div className="filter-row">
          <label>
            {t('common:filter.type')}
            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as typeof kindFilter)
              }
            >
              <option value="all">{t('common:filter.typeAll')}</option>
              <option value="shift">{t('common:filter.typeShift')}</option>
              <option value="note">{t('common:filter.typeNote')}</option>
              {showTasks ? <option value="task">{t('common:filter.typeTask')}</option> : null}
            </select>
          </label>

          <label>
            {t('common:filter.staff')}
            <select
              value={personnelFilterId ?? ''}
              onChange={(event) =>
                setPersonnelFilterId(event.target.value ? event.target.value : null)
              }
            >
              <option value="">{t('common:filter.staffAnyone')}</option>
              {(personnelQuery.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="modal-hint">{t('common:filter.applyHint')}</p>
      </Modal>

      <Modal open={openModal === 'security'} onClose={closeModal} title={t('common:nav.configuration')} wide>
        <UserSecurityScreen />
      </Modal>

      <Modal
        open={openModal === 'notifications'}
        onClose={closeModal}
        title={t('notifications:panel.title')}
        variant="panel"
      >
        <NotificationsPanel />
      </Modal>

      <Modal open={openModal === 'stats'} onClose={closeModal} title={t('common:nav.workforceStats')} wide>
        <StatsPanel onDrillDown={handleStatsDrillDown} />
      </Modal>

      <CalendarEventModal />
    </div>
  )
}

export default App
