import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { useCalendarShell } from '../calendar/CalendarShellContext'
import { calendarItems as demoCalendarItems } from '../../data/demo'
import {
  getDemoNotifications,
  getDemoPendingAcknowledgements,
  isNotificationDue,
  markAndFilterNewDueNotifications,
  useAcknowledgeCalendarItem,
  useInAppNotifications,
  usePendingAcknowledgements,
  type InAppNotification,
} from '../../lib/queries/notifications'
import { useCalendarItems } from '../../lib/queries/workspace'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  showDesktopNotification,
} from './desktop'
import { ToastStack, type NotificationToast } from './ToastStack'

interface NotificationContextValue {
  dueCount: number
  badgeCount: number
  desktopPermission: NotificationPermission
  requestDesktopPermission: () => Promise<NotificationPermission>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const { organizationId } = useWorkspace()
  const { openEditEvent } = useCalendarShell()
  const calendarQuery = useCalendarItems(organizationId)

  const calendarItems = isSupabaseConfigured
    ? (calendarQuery.data ?? [])
    : demoCalendarItems

  const notificationsQuery = useInAppNotifications(organizationId, user?.id ?? null, 30_000)
  const pendingAcksQuery = usePendingAcknowledgements(
    organizationId,
    user?.id ?? null,
    calendarItems,
  )
  const acknowledgeItem = useAcknowledgeCalendarItem(organizationId, user?.id ?? null)

  const [toasts, setToasts] = useState<NotificationToast[]>([])
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    getDesktopNotificationPermission(),
  )
  const shownNotificationIds = useRef(new Set<string>())

  const notifications = isSupabaseConfigured
    ? (notificationsQuery.data ?? [])
    : getDemoNotifications()

  const dueNotifications = notifications.filter((item) => isNotificationDue(item.scheduledFor))
  const pendingAcks = isSupabaseConfigured
    ? (pendingAcksQuery.data ?? [])
    : getDemoPendingAcknowledgements(demoCalendarItems)
  const badgeCount = dueNotifications.length + pendingAcks.length

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const openNotification = useCallback(
    (notification: InAppNotification) => {
      const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
      if (item) {
        openEditEvent(item)
      }
    },
    [calendarItems, openEditEvent],
  )

  const openNotificationAndDismiss = useCallback(
    (notification: InAppNotification) => {
      openNotification(notification)
      dismissToast(notification.id)
    },
    [dismissToast, openNotification],
  )

  const acknowledgeAndDismiss = useCallback(
    async (calendarItemId: string) => {
      await acknowledgeItem.mutateAsync(calendarItemId)
      setToasts((current) =>
        current.filter((toast) => toast.notification.calendarItemId !== calendarItemId),
      )
    },
    [acknowledgeItem],
  )

  const requestDesktopPermission = useCallback(async () => {
    const permission = await requestDesktopNotificationPermission()
    setDesktopPermission(permission)
    return permission
  }, [])

  useEffect(() => {
    const fresh = markAndFilterNewDueNotifications(
      dueNotifications,
      shownNotificationIds.current,
    )
    if (fresh.length === 0) return

    setToasts((current) => [
      ...current,
      ...fresh.map((notification) => ({ id: notification.id, notification })),
    ])

    for (const notification of fresh) {
      showDesktopNotification(notification, () => openNotification(notification))
    }
  }, [dueNotifications, openNotification])

  const value = useMemo(
    () => ({
      dueCount: dueNotifications.length,
      badgeCount,
      desktopPermission,
      requestDesktopPermission,
    }),
    [badgeCount, desktopPermission, dueNotifications.length, requestDesktopPermission],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastStack
        toasts={toasts}
        onOpen={openNotificationAndDismiss}
        onDismiss={dismissToast}
        onAcknowledge={
          acknowledgeItem.isPending ? undefined : (calendarItemId) => void acknowledgeAndDismiss(calendarItemId)
        }
      />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
