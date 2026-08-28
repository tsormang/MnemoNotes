import { Bell, Check, Clock, Monitor, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { useNotifications } from '../notifications/NotificationProvider'
import { calendarItems as demoCalendarItems } from '../../data/demo'
import { getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  formatNotificationTiming,
  getDemoNotifications,
  getDemoPendingAcknowledgements,
  isActiveDueNotification,
  useAcknowledgeCalendarItem,
  useInAppNotifications,
  usePendingAcknowledgements,
  useRefreshNotifications,
  type InAppNotification,
} from '../../lib/queries/notifications'
import { useCalendarItems, usePersonnelList } from '../../lib/queries/workspace'
import type { CalendarItem } from '../../types/domain'

function notificationLabel(
  notification: InAppNotification,
  calendarItems: CalendarItem[],
  personnel: { id: string; fullName: string }[],
): string {
  const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
  if (item) return getCalendarItemDisplayLabel(item, personnel)
  return notification.title || `${notification.kind} reminder`
}

export function NotificationsPanel() {
  const { user } = useAuth()
  const { organizationId } = useWorkspace()
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const calendarItems = isSupabaseConfigured
    ? (calendarQuery.data ?? [])
    : demoCalendarItems
  const personnel = personnelQuery.data ?? []
  const notificationsQuery = useInAppNotifications(organizationId, user?.id ?? null)
  const pendingAcksQuery = usePendingAcknowledgements(
    organizationId,
    user?.id ?? null,
    calendarItems,
  )
  const acknowledgeItem = useAcknowledgeCalendarItem(organizationId, user?.id ?? null)
  const refreshNotifications = useRefreshNotifications()
  const {
    desktopPermission,
    requestDesktopPermission,
    openNotificationAndDismiss,
    clearNotification,
    clearAllDueNotifications,
    isClearingNotifications,
  } = useNotifications()

  const notifications = isSupabaseConfigured
    ? (notificationsQuery.data ?? [])
    : getDemoNotifications()

  const pendingAcks = isSupabaseConfigured
    ? (pendingAcksQuery.data ?? [])
    : getDemoPendingAcknowledgements(demoCalendarItems)
  const activeDueNotifications = notifications.filter((item) =>
    isActiveDueNotification(item, calendarItems),
  )
  const upcomingNotifications = notifications.filter(
    (item) => !isActiveDueNotification(item, calendarItems) && item.status !== 'expired',
  )

  return (
    <div className="notifications-panel">
      <div className="metric-grid">
        <div className="metric">
          <span>Due now</span>
          <strong>{activeDueNotifications.length}</strong>
        </div>
        <div className="metric">
          <span>Upcoming</span>
          <strong>{upcomingNotifications.length}</strong>
        </div>
        <div className="metric">
          <span>Acks due</span>
          <strong>{pendingAcks.length}</strong>
        </div>
        <div className="metric">
          <span>Total rules</span>
          <strong>{notifications.length}</strong>
        </div>
      </div>

      {isSupabaseConfigured ? (
        <div className="notifications-toolbar">
          {desktopPermission === 'default' ? (
            <button
              className="button-secondary button-secondary--compact"
              type="button"
              onClick={() => void requestDesktopPermission()}
            >
              <Monitor size={16} aria-hidden="true" />
              Enable desktop alerts
            </button>
          ) : null}
          {desktopPermission === 'granted' ? (
            <span className="notifications-status">
              <Monitor size={14} aria-hidden="true" />
              Desktop alerts on
            </span>
          ) : null}
          {desktopPermission === 'denied' ? (
            <span className="notifications-status notifications-status--muted">
              Desktop alerts blocked in browser settings
            </span>
          ) : null}
          {activeDueNotifications.length > 0 ? (
            <button
              className="button-secondary button-secondary--compact"
              type="button"
              disabled={isClearingNotifications}
              onClick={() => void clearAllDueNotifications()}
            >
              <X size={16} aria-hidden="true" />
              Clear due
            </button>
          ) : null}
          <button
            className="button-secondary button-secondary--compact"
            type="button"
            disabled={refreshNotifications.isPending}
            onClick={() => void refreshNotifications.mutateAsync()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh jobs
          </button>
        </div>
      ) : null}

      {pendingAcks.length > 0 ? (
        <div className="timeline-list">
          <p className="eyebrow">Acknowledgements due</p>
          {pendingAcks.map((item) => (
            <article className="timeline-item" key={item.calendarItemId}>
              <div className="timeline-icon note">
                <ShieldAlert size={18} aria-hidden="true" />
              </div>
              <div className="timeline-item__body">
                <h3>{item.title || `${item.kind} item`}</h3>
                <p>
                  {format(new Date(item.startsAt), 'EEE d MMM, HH:mm')}
                  {' — '}
                  {format(new Date(item.endsAt), 'HH:mm')}
                </p>
              </div>
              <button
                className="button-primary button-primary--compact"
                type="button"
                disabled={acknowledgeItem.isPending}
                onClick={() => void acknowledgeItem.mutateAsync(item.calendarItemId)}
              >
                <Check size={16} aria-hidden="true" />
                Acknowledge
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="timeline-list">
        <p className="eyebrow">Due now</p>
        {activeDueNotifications.length === 0 ? (
          <p className="modal-hint">No notifications are due right now.</p>
        ) : (
          activeDueNotifications.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className={`timeline-icon ${item.kind}`}>
                {item.requiresAcknowledgement ? (
                  <ShieldAlert size={18} aria-hidden="true" />
                ) : (
                  <Clock size={18} aria-hidden="true" />
                )}
              </div>
              <div className="timeline-item__body">
                <h3>{notificationLabel(item, calendarItems, personnel)}</h3>
                <p>
                  {formatNotificationTiming(
                    item.scheduledFor,
                    item.triggerKind,
                    item.offsetMinutes,
                  )}
                  {item.requiresAcknowledgement ? ' · acknowledgement required' : ''}
                </p>
              </div>
              <div className="timeline-item__actions">
                {item.requiresAcknowledgement ? (
                  <button
                    className="button-primary button-primary--compact"
                    type="button"
                    disabled={acknowledgeItem.isPending}
                    onClick={() => void acknowledgeItem.mutateAsync(item.calendarItemId)}
                  >
                    <Check size={16} aria-hidden="true" />
                    Ack
                  </button>
                ) : null}
                <button
                  className="button-secondary button-secondary--compact"
                  type="button"
                  onClick={() => openNotificationAndDismiss(item)}
                >
                  Open
                </button>
                <button
                  className="icon-ghost timeline-item__dismiss"
                  type="button"
                  aria-label="Dismiss notification"
                  disabled={isClearingNotifications}
                  onClick={() => clearNotification(item)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {upcomingNotifications.length > 0 ? (
        <div className="timeline-list">
          <p className="eyebrow">Upcoming</p>
          {upcomingNotifications.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className={`timeline-icon ${item.kind}`}>
                <Clock size={18} aria-hidden="true" />
              </div>
              <div className="timeline-item__body">
                <h3>{notificationLabel(item, calendarItems, personnel)}</h3>
                <p>
                  {formatNotificationTiming(
                    item.scheduledFor,
                    item.triggerKind,
                    item.offsetMinutes,
                  )}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="notification-card">
        <Bell size={20} aria-hidden="true" />
        <div>
          <h3>Notification engine</h3>
          <p>
            Reminders appear when due. Open or dismiss clears them from the bell; acknowledgements
            stay until you confirm.
          </p>
        </div>
      </div>
    </div>
  )
}
