import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabase'
import { Modal } from './Modal'

type ShellModal = 'search' | 'security' | 'notifications' | 'stats'

interface AppBarActionsProps {
  showSecondaryNav: boolean
  showPeopleLink: boolean
  canReadAudit: boolean
  canReadStats: boolean
  badgeCount: number
  onOpenModal: (modal: ShellModal) => void
}

interface MenuItem {
  id: string
  labelKey: string
  icon: LucideIcon
  to?: string
  modal?: ShellModal
  badge?: number
  visible: boolean
}

export function AppBarActions({
  showSecondaryNav,
  showPeopleLink,
  canReadAudit,
  canReadStats,
  badgeCount,
  onOpenModal,
}: AppBarActionsProps) {
  const { t } = useTranslation('common')
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const closeMenu = () => setMenuOpen(false)

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'calendar',
        labelKey: 'nav.calendar',
        icon: CalendarDays,
        to: '/app/calendar',
        visible: showSecondaryNav,
      },
      {
        id: 'search',
        labelKey: 'nav.searchFilter',
        icon: Search,
        modal: 'search',
        visible: true,
      },
      {
        id: 'people',
        labelKey: 'nav.personnelRoles',
        icon: Users,
        to: '/app/people',
        visible: showPeopleLink,
      },
      {
        id: 'audit',
        labelKey: 'nav.auditLog',
        icon: ClipboardList,
        to: '/app/audit',
        visible: canReadAudit,
      },
      {
        id: 'stats',
        labelKey: 'nav.workforceStats',
        icon: BarChart3,
        modal: 'stats',
        visible: canReadStats,
      },
      {
        id: 'security',
        labelKey: 'nav.configuration',
        icon: Settings,
        modal: 'security',
        visible: true,
      },
      {
        id: 'notifications',
        labelKey: 'nav.notifications',
        icon: Bell,
        modal: 'notifications',
        badge: badgeCount,
        visible: true,
      },
    ],
    [badgeCount, canReadAudit, canReadStats, showPeopleLink, showSecondaryNav],
  )

  const handleMenuItemClick = (item: MenuItem) => {
    closeMenu()
    if (item.to) {
      navigate(item.to)
      return
    }
    if (item.modal) {
      onOpenModal(item.modal)
    }
  }

  return (
    <>
      <nav className="app-bar-actions" aria-label={t('nav.appActions')}>
        <div className="app-bar-actions__desktop">
          {showSecondaryNav ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/calendar"
              aria-label={t('nav.calendar')}
            >
              <CalendarDays size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          <button
            className="icon-ghost"
            type="button"
            aria-label={t('nav.searchFilter')}
            onClick={() => onOpenModal('search')}
          >
            <Search size={19} aria-hidden="true" />
          </button>
          {showPeopleLink ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/people"
              aria-label={t('nav.personnelRoles')}
            >
              <Users size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          {canReadAudit ? (
            <NavLink
              className={({ isActive }) => `icon-ghost${isActive ? ' icon-ghost--active' : ''}`}
              to="/app/audit"
              aria-label={t('nav.auditLog')}
            >
              <ClipboardList size={19} aria-hidden="true" />
            </NavLink>
          ) : null}
          {canReadStats ? (
            <button
              className="icon-ghost"
              type="button"
              aria-label={t('nav.workforceStats')}
              onClick={() => onOpenModal('stats')}
            >
              <BarChart3 size={19} aria-hidden="true" />
            </button>
          ) : null}
          <button
            className="icon-ghost"
            type="button"
            aria-label={t('nav.configuration')}
            onClick={() => onOpenModal('security')}
          >
            <Settings size={19} aria-hidden="true" />
          </button>
          <button
            className={`icon-ghost${badgeCount > 0 ? ' icon-ghost--badged' : ''}`}
            type="button"
            aria-label={
              badgeCount > 0
                ? t('nav.notificationsDue', { count: badgeCount })
                : t('nav.notifications')
            }
            onClick={() => onOpenModal('notifications')}
          >
            <Bell size={19} aria-hidden="true" />
            {badgeCount > 0 ? <span className="icon-badge">{badgeCount}</span> : null}
          </button>
          {isSupabaseConfigured ? <SignOutIconButton /> : null}
        </div>

        <div className="app-bar-actions__mobile">
          <button
            className={`icon-ghost${badgeCount > 0 ? ' icon-ghost--badged' : ''}`}
            type="button"
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
            {badgeCount > 0 ? <span className="icon-badge">{badgeCount}</span> : null}
          </button>
        </div>
      </nav>

      <Modal open={menuOpen} onClose={closeMenu} title={t('nav.menu')}>
        <ul className="app-menu-list">
          {menuItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon
              const isActive = item.to ? location.pathname.startsWith(item.to) : false

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`app-menu-item${isActive ? ' app-menu-item--active' : ''}`}
                    onClick={() => handleMenuItemClick(item)}
                  >
                    <span className="app-menu-item__icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="app-menu-item__label">{t(item.labelKey)}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="app-menu-item__badge">{item.badge}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          {isSupabaseConfigured ? (
            <li>
              <MobileSignOutItem onClose={closeMenu} />
            </li>
          ) : null}
        </ul>
      </Modal>
    </>
  )
}

function SignOutIconButton() {
  const { t } = useTranslation('common')
  const { signOut } = useAuth()

  return (
    <button
      className="icon-ghost"
      type="button"
      aria-label={t('actions.signOut')}
      onClick={() => void signOut()}
    >
      <LogOut size={19} aria-hidden="true" />
    </button>
  )
}

function MobileSignOutItem({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const { signOut } = useAuth()

  return (
    <button
      type="button"
      className="app-menu-item app-menu-item--danger"
      onClick={() => {
        onClose()
        void signOut()
      }}
    >
      <span className="app-menu-item__icon" aria-hidden="true">
        <LogOut size={20} />
      </span>
      <span className="app-menu-item__label">{t('actions.signOut')}</span>
    </button>
  )
}
