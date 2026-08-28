import type { InAppNotification } from '../../lib/queries/notifications'

export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getDesktopNotificationPermission(): NotificationPermission {
  if (!isDesktopNotificationSupported()) return 'denied'
  return Notification.permission
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!isDesktopNotificationSupported()) return 'denied'
  if (Notification.permission === 'default') {
    return Notification.requestPermission()
  }
  return Notification.permission
}

export function showDesktopNotification(
  notification: InAppNotification,
  onClick?: () => void,
): void {
  if (!isDesktopNotificationSupported() || Notification.permission !== 'granted') {
    return
  }

  const body = notification.requiresAcknowledgement
    ? 'Acknowledgement required'
    : `${notification.kind} reminder`

  const desktopNotification = new Notification(notification.title, {
    body,
    tag: notification.id,
  })

  if (onClick) {
    desktopNotification.onclick = () => {
      window.focus()
      onClick()
      desktopNotification.close()
    }
  }
}
