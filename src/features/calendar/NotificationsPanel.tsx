import { Bell, Check, Clock, Monitor, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { useNotifications } from '../notifications/NotificationProvider'
import { calendarItems as demoCalendarItems } from '../../data/demo'
import { getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { filterVisibleCalendarItems, filterVisibleTaskKinds } from '../../lib/display-preferences'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useDisplayPreferences } from '../../store/display-preferences'
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
import type { CalendarItem, CalendarItemKind } from '../../types/domain'

function notificationLabel(
  notification: InAppNotification,
  calendarItems: CalendarItem[],
  personnel: { id: string; fullName: string }[],
  fallbackReminder: string,
): string {
  const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
  if (item) return getCalendarItemDisplayLabel(item, personnel)
  return notification.title || fallbackReminder
}

export function NotificationsPanel() {
  const { t } = useTranslation(['notifications', 'common'])
  const { user } = useAuth()
  const { organizationId } = useWorkspace()
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const showTasks = useDisplayPreferences((state) => state.showTasks)
  const calendarItems = filterVisibleCalendarItems(
    isSupabaseConfigured ? (calendarQuery.data ?? []) : demoCalendarItems,
    showTasks,
  )
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

  const notifications = filterVisibleTaskKinds(
    isSupabaseConfigured ? (notificationsQuery.data ?? []) : getDemoNotifications(),
    showTasks,
  )

  const pendingAcks = filterVisibleTaskKinds(
    isSupabaseConfigured
      ? (pendingAcksQuery.data ?? [])
      : getDemoPendingAcknowledgements(calendarItems),
    showTasks,
  )
  const activeDueNotifications = notifications.filter((item) =>
    isActiveDueNotification(item, calendarItems),
  )
  const upcomingNotifications = notifications.filter(
    (item) => !isActiveDueNotification(item, calendarItems) && item.status !== 'expired',
  )

  const kindLabel = (kind: CalendarItemKind) => t(`common:eventKind.${kind}`)

  const reminderFallback = (kind: CalendarItemKind) =>
    t('notifications:item.fallbackReminder', { kind: kindLabel(kind) })

  return (
    <div className="notifications-panel">
      <div className="metric-grid">
        <div className="metric">
          <span>{t('notifications:metrics.dueNow')}</span>
          <strong>{activeDueNotifications.length}</strong>
        </div>
        <div className="metric">
          <span>{t('notifications:metrics.upcoming')}</span>
          <strong>{upcomingNotifications.length}</strong>
        </div>
        <div className="metric">
          <span>{t('notifications:metrics.acksDue')}</span>
          <strong>{pendingAcks.length}</strong>
        </div>
        <div className="metric">
          <span>{t('notifications:metrics.totalRules')}</span>
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
              {t('notifications:desktop.enable')}
            </button>
          ) : null}
          {desktopPermission === 'granted' ? (
            <span
              className="notifications-status"
              title={t('notifications:desktop.onHint')}
            >
              <Monitor size={14} aria-hidden="true" />
              {t('notifications:desktop.on')}
            </span>
          ) : null}
          {desktopPermission === 'denied' ? (
            <span className="notifications-status notifications-status--muted">
              {t('notifications:desktop.blocked')}
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
              {t('notifications:actions.clearDue')}
            </button>
          ) : null}
          <button
            className="icon-ghost"
            type="button"
            aria-label={t('notifications:actions.refreshJobs')}
            disabled={refreshNotifications.isPending}
            onClick={() => void refreshNotifications.mutateAsync()}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              data-spin={refreshNotifications.isPending ? 'true' : undefined}
            />
          </button>
        </div>
      ) : null}

      {pendingAcks.length > 0 ? (
        <div className="timeline-list">
          <p className="eyebrow">{t('notifications:section.acksDue')}</p>
          {pendingAcks.map((item) => (
            <article className="timeline-item" key={item.calendarItemId}>
              <div className="timeline-icon note">
                <ShieldAlert size={18} aria-hidden="true" />
              </div>
              <div className="timeline-item__body">
                <h3>
                  {item.title ||
                    t('notifications:item.fallbackTitle', { kind: kindLabel(item.kind) })}
                </h3>
                <p>
                  {format(new Date(item.startsAt), 'EEE d MMM, HH:mm')}
                  {' — '}
                  {format(new Date(item.endsAt), 'HH:mm')}
                </p>
              </div>
              <div className="timeline-item__actions">
                <button
                  className="button-primary button-primary--compact"
                  type="button"
                  disabled={acknowledgeItem.isPending}
                  onClick={() => void acknowledgeItem.mutateAsync(item.calendarItemId)}
                >
                  <Check size={16} aria-hidden="true" />
                  {t('notifications:actions.acknowledge')}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="timeline-list">
        <p className="eyebrow">{t('notifications:section.dueNow')}</p>
        {activeDueNotifications.length === 0 ? (
          <p className="modal-hint">{t('notifications:section.emptyDue')}</p>
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
                <h3>
                  {notificationLabel(
                    item,
                    calendarItems,
                    personnel,
                    reminderFallback(item.kind as CalendarItemKind),
                  )}
                </h3>
                <p>
                  {formatNotificationTiming(
                    item.scheduledFor,
                    item.triggerKind,
                    item.offsetMinutes,
                  )}
                  {item.requiresAcknowledgement ? t('notifications:item.ackRequired') : ''}
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
                    {t('notifications:actions.ack')}
                  </button>
                ) : null}
                <button
                  className="button-secondary button-secondary--compact"
                  type="button"
                  onClick={() => openNotificationAndDismiss(item)}
                >
                  {t('common:actions.open')}
                </button>
                <button
                  className="icon-ghost timeline-item__dismiss"
                  type="button"
                  aria-label={t('notifications:actions.dismissAria')}
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
          <p className="eyebrow">{t('notifications:section.upcoming')}</p>
          {upcomingNotifications.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className={`timeline-icon ${item.kind}`}>
                <Clock size={18} aria-hidden="true" />
              </div>
              <div className="timeline-item__body">
                <h3>
                  {notificationLabel(
                    item,
                    calendarItems,
                    personnel,
                    reminderFallback(item.kind as CalendarItemKind),
                  )}
                </h3>
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
          <h3>{t('notifications:engine.title')}</h3>
          <p>{t('notifications:engine.description')}</p>
        </div>
      </div>
    </div>
  )
}
