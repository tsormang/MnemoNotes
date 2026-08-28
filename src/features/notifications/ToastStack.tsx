import { Check, X } from 'lucide-react'
import { format } from 'date-fns'
import type { InAppNotification } from '../../lib/queries/notifications'

export interface NotificationToast {
  id: string
  notification: InAppNotification
}

interface ToastStackProps {
  toasts: NotificationToast[]
  onOpen: (notification: InAppNotification) => void
  onDismiss: (notification: InAppNotification) => void
  onAcknowledge?: (calendarItemId: string) => void
}

export function ToastStack({ toasts, onOpen, onDismiss, onAcknowledge }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <article className="toast-card" key={toast.id}>
          <div className="toast-card__body">
            <strong>{toast.notification.title}</strong>
            <p>
              {format(new Date(toast.notification.scheduledFor), 'EEE d MMM, HH:mm')}
              {toast.notification.requiresAcknowledgement ? ' · acknowledgement required' : ''}
            </p>
          </div>
          <div className="toast-card__actions">
            {toast.notification.requiresAcknowledgement && onAcknowledge ? (
              <button
                className="button-primary button-primary--compact"
                type="button"
                onClick={() => onAcknowledge(toast.notification.calendarItemId)}
              >
                <Check size={14} aria-hidden="true" />
                Ack
              </button>
            ) : null}
            <button
              className="button-secondary button-secondary--compact"
              type="button"
              onClick={() => onOpen(toast.notification)}
            >
              Open
            </button>
            <button
              className="icon-ghost toast-card__dismiss"
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.notification)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
