import { Bell, Check, Clock, RefreshCw, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  getDemoNotifications,
  isNotificationDue,
  useAcknowledgeCalendarItem,
  useInAppNotifications,
  usePendingAcknowledgements,
  useRefreshNotifications,
} from '../../lib/queries/notifications'
import { useCalendarItems } from '../../lib/queries/workspace'

export function NotificationsPanel() {
  const { user } = useAuth()
  const { organizationId } = useWorkspace()
  const calendarQuery = useCalendarItems(organizationId)
  const notificationsQuery = useInAppNotifications(organizationId, user?.id ?? null)
  const pendingAcksQuery = usePendingAcknowledgements(
    organizationId,
    user?.id ?? null,
    calendarQuery.data ?? [],
  )
  const acknowledgeItem = useAcknowledgeCalendarItem(organizationId, user?.id ?? null)
  const refreshNotifications = useRefreshNotifications()

  const notifications = isSupabaseConfigured
    ? (notificationsQuery.data ?? [])
    : getDemoNotifications()

  const pendingAcks = pendingAcksQuery.data ?? []
  const dueNotifications = notifications.filter((item) => isNotificationDue(item.scheduledFor))
  const upcomingNotifications = notifications.filter((item) => !isNotificationDue(item.scheduledFor))

  return (
    <div className="notifications-panel">
      <div className="metric-grid">
        <div className="metric">
          <span>Due now</span>
          <strong>{dueNotifications.length}</strong>
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
        {dueNotifications.length === 0 ? (
          <p className="modal-hint">No notifications are due right now.</p>
        ) : (
          dueNotifications.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className={`timeline-icon ${item.kind}`}>
                {item.requiresAcknowledgement ? (
                  <ShieldAlert size={18} aria-hidden="true" />
                ) : (
                  <Clock size={18} aria-hidden="true" />
                )}
              </div>
              <div>
                <h3>{item.title}</h3>
                <p>
                  {format(new Date(item.scheduledFor), 'EEE d MMM, HH:mm')}
                  {item.requiresAcknowledgement ? ' · acknowledgement required' : ''}
                </p>
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
              <div>
                <h3>{item.title}</h3>
                <p>{format(new Date(item.scheduledFor), 'EEE d MMM, HH:mm')}</p>
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
            Calendar saves sync reminder rules. Jobs are materialized by the schedule-notifications
            Edge Function and appear here when due.
          </p>
        </div>
      </div>
    </div>
  )
}
