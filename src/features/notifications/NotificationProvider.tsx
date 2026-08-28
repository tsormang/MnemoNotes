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
  isActiveDueNotification,
  markAndFilterNewDueNotifications,
  shouldPopupNotification,
  useAcknowledgeCalendarItem,
  useDismissNotificationJob,
  useDismissNotificationJobs,
  useExpireStaleNotificationJobs,
  useInAppNotifications,
  useMarkNotificationsSurfaced,
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

const DEMO_NOTIFICATION_STATE_KEY = 'mnemonotes-demo-notification-state'

interface DemoNotificationState {
  surfaced: string[]
  dismissed: string[]
}

function readDemoNotificationState(): DemoNotificationState {
  if (typeof window === 'undefined') return { surfaced: [], dismissed: [] }

  try {
    const raw = window.sessionStorage.getItem(DEMO_NOTIFICATION_STATE_KEY)
    if (!raw) return { surfaced: [], dismissed: [] }
    const parsed = JSON.parse(raw) as DemoNotificationState
    return {
      surfaced: parsed.surfaced ?? [],
      dismissed: parsed.dismissed ?? [],
    }
  } catch {
    return { surfaced: [], dismissed: [] }
  }
}

function writeDemoNotificationState(state: DemoNotificationState) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(DEMO_NOTIFICATION_STATE_KEY, JSON.stringify(state))
}

interface NotificationContextValue {
  dueCount: number
  badgeCount: number
  desktopPermission: NotificationPermission
  requestDesktopPermission: () => Promise<NotificationPermission>
  openNotification: (notification: InAppNotification) => void
  openNotificationAndDismiss: (notification: InAppNotification) => void
  clearNotification: (notification: InAppNotification) => void
  clearAllDueNotifications: () => Promise<void>
  isClearingNotifications: boolean
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
  const dismissJob = useDismissNotificationJob(organizationId, user?.id ?? null)
  const dismissJobs = useDismissNotificationJobs(organizationId, user?.id ?? null)
  const markSurfaced = useMarkNotificationsSurfaced(organizationId, user?.id ?? null)
  const expireStaleJobs = useExpireStaleNotificationJobs(
    organizationId,
    user?.id ?? null,
    calendarItems,
  )

  const [toasts, setToasts] = useState<NotificationToast[]>([])
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    getDesktopNotificationPermission(),
  )
  const [demoNotificationState, setDemoNotificationState] = useState<DemoNotificationState>(
    readDemoNotificationState,
  )
  const shownNotificationIds = useRef(new Set<string>())
  const staleExpiryAttempted = useRef(new Set<string>())

  const notifications = isSupabaseConfigured
    ? (notificationsQuery.data ?? [])
    : getDemoNotifications()

  const activeDueNotifications = notifications.filter((item) =>
    isActiveDueNotification(item, calendarItems),
  )

  const popupCandidates = isSupabaseConfigured
    ? activeDueNotifications.filter(shouldPopupNotification)
    : activeDueNotifications.filter(
        (item) =>
          shouldPopupNotification(item) &&
          !demoNotificationState.surfaced.includes(item.id) &&
          !demoNotificationState.dismissed.includes(item.id),
      )

  const pendingAcks = isSupabaseConfigured
    ? (pendingAcksQuery.data ?? [])
    : getDemoPendingAcknowledgements(demoCalendarItems)
  const badgeCount = activeDueNotifications.length + pendingAcks.length

  useEffect(() => {
    if (!isSupabaseConfigured || activeDueNotifications.length === 0) return

    const stale = activeDueNotifications.filter((notification) => {
      if (notification.requiresAcknowledgement) return false
      const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
      return item && new Date(item.endsAt).getTime() <= Date.now()
    })

    const staleKey = stale.map((item) => item.id).join(',')
    if (stale.length === 0 || staleExpiryAttempted.current.has(staleKey)) return

    staleExpiryAttempted.current.add(staleKey)
    void expireStaleJobs.mutateAsync(activeDueNotifications)
  }, [activeDueNotifications, calendarItems, expireStaleJobs])

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const clearNotification = useCallback(
    (notification: InAppNotification) => {
      dismissToast(notification.id)

      if (isSupabaseConfigured) {
        void dismissJob.mutateAsync(notification.id)
        return
      }

      const nextState = {
        ...demoNotificationState,
        dismissed: [...new Set([...demoNotificationState.dismissed, notification.id])],
      }
      setDemoNotificationState(nextState)
      writeDemoNotificationState(nextState)
    },
    [dismissJob, dismissToast, demoNotificationState],
  )

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
      clearNotification(notification)
    },
    [clearNotification, openNotification],
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

  const clearAllDueNotifications = useCallback(async () => {
    if (activeDueNotifications.length === 0) return

    for (const notification of activeDueNotifications) {
      dismissToast(notification.id)
    }

    if (isSupabaseConfigured) {
      await dismissJobs.mutateAsync(activeDueNotifications.map((notification) => notification.id))
      return
    }

    const nextState = {
      ...demoNotificationState,
      dismissed: [
        ...new Set([
          ...demoNotificationState.dismissed,
          ...activeDueNotifications.map((notification) => notification.id),
        ]),
      ],
    }
    setDemoNotificationState(nextState)
    writeDemoNotificationState(nextState)
  }, [activeDueNotifications, dismissJobs, dismissToast, demoNotificationState])

  useEffect(() => {
    const fresh = markAndFilterNewDueNotifications(popupCandidates, shownNotificationIds.current)
    if (fresh.length === 0) return

    setToasts((current) => [
      ...current,
      ...fresh.map((notification) => ({ id: notification.id, notification })),
    ])

    for (const notification of fresh) {
      showDesktopNotification(notification, () => openNotification(notification))
    }

    if (isSupabaseConfigured) {
      void markSurfaced.mutateAsync(fresh.map((notification) => notification.id))
      return
    }

    const nextState = {
      ...demoNotificationState,
      surfaced: [...new Set([...demoNotificationState.surfaced, ...fresh.map((item) => item.id)])],
    }
    setDemoNotificationState(nextState)
    writeDemoNotificationState(nextState)
  }, [demoNotificationState, markSurfaced, openNotification, popupCandidates])

  const value = useMemo(
    () => ({
      dueCount: activeDueNotifications.length,
      badgeCount,
      desktopPermission,
      requestDesktopPermission,
      openNotification,
      openNotificationAndDismiss,
      clearNotification,
      clearAllDueNotifications,
      isClearingNotifications: dismissJob.isPending || dismissJobs.isPending,
    }),
    [
      activeDueNotifications.length,
      badgeCount,
      clearAllDueNotifications,
      clearNotification,
      desktopPermission,
      dismissJob.isPending,
      dismissJobs.isPending,
      openNotification,
      openNotificationAndDismiss,
      requestDesktopPermission,
    ],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastStack
        toasts={toasts}
        onOpen={openNotificationAndDismiss}
        onDismiss={clearNotification}
        onAcknowledge={
          acknowledgeItem.isPending
            ? undefined
            : (calendarItemId) => void acknowledgeAndDismiss(calendarItemId)
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
