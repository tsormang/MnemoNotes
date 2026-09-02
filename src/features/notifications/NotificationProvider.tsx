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
import { isCalendarItemPassed } from '../../lib/calendar-datetime'
import { filterVisibleCalendarItems, filterVisibleTaskKinds } from '../../lib/display-preferences'
import { useDisplayPreferences } from '../../store/display-preferences'
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
import { isNativeApp } from '../../lib/capacitor'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  showDesktopNotification,
} from './desktop'
import { useNativePushNotifications } from './push'
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
  isNativePushSupported: boolean
  mobilePermission: 'prompt' | 'granted' | 'denied' | 'unsupported'
  mobilePushRegistered: boolean
  isRegisteringMobile: boolean
  mobileRegistrationError: string | null
  requestMobilePermission: () => Promise<'prompt' | 'granted' | 'denied' | 'unsupported'>
  retryMobileRegistration: () => Promise<void>
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
  const showTasks = useDisplayPreferences((state) => state.showTasks)
  const calendarQuery = useCalendarItems(organizationId)

  const calendarItems = filterVisibleCalendarItems(
    isSupabaseConfigured ? (calendarQuery.data ?? []) : demoCalendarItems,
    showTasks,
  )

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
  const [, setDueTick] = useState(0)
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    getDesktopNotificationPermission(),
  )
  const [demoNotificationState, setDemoNotificationState] = useState<DemoNotificationState>(
    readDemoNotificationState,
  )
  const shownNotificationIds = useRef(new Set<string>())
  const staleExpiryAttempted = useRef(new Set<string>())

  const notifications = filterVisibleTaskKinds(
    isSupabaseConfigured ? (notificationsQuery.data ?? []) : getDemoNotifications(),
    showTasks,
  )

  const activeDueNotifications = notifications.filter((item) =>
    isActiveDueNotification(item, calendarItems),
  )

  const popupCandidates = isSupabaseConfigured
    ? activeDueNotifications.filter((item) => shouldPopupNotification(item, calendarItems))
    : activeDueNotifications.filter(
        (item) =>
          shouldPopupNotification(item, calendarItems) &&
          !demoNotificationState.surfaced.includes(item.id) &&
          !demoNotificationState.dismissed.includes(item.id),
      )

  const pendingAcks = filterVisibleTaskKinds(
    isSupabaseConfigured
      ? (pendingAcksQuery.data ?? [])
      : getDemoPendingAcknowledgements(calendarItems),
    showTasks,
  )
  const badgeCount = activeDueNotifications.length + pendingAcks.length

  useEffect(() => {
    const intervalId = window.setInterval(() => setDueTick((tick) => tick + 1), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || activeDueNotifications.length === 0) return

    const stale = activeDueNotifications.filter((notification) => {
      const item = calendarItems.find((entry) => entry.id === notification.calendarItemId)
      return item && isCalendarItemPassed(item)
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

  const openCalendarItem = useCallback(
    (calendarItemId: string) => {
      const item = calendarItems.find((entry) => entry.id === calendarItemId)
      if (item) {
        openEditEvent(item)
      }
    },
    [calendarItems, openEditEvent],
  )

  const openNotification = useCallback(
    (notification: InAppNotification) => {
      openCalendarItem(notification.calendarItemId)
    },
    [openCalendarItem],
  )

  const {
    isNativePushSupported,
    mobilePermission,
    registeredToken,
    isRegisteringMobile,
    mobileRegistrationError,
    requestMobilePermission,
    retryMobileRegistration,
  } = useNativePushNotifications({
    organizationId,
    userId: user?.id ?? null,
    onDeepLink: ({ calendarItemId }) => openCalendarItem(calendarItemId),
    onForegroundPush: isNativeApp()
      ? undefined
      : ({ calendarItemId }) => openCalendarItem(calendarItemId),
  })

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

    // Native APK: system push only — keep panel/badge, skip toast popups.
    if (isNativeApp()) return

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
      isNativePushSupported,
      mobilePermission,
      mobilePushRegistered: Boolean(registeredToken),
      isRegisteringMobile,
      mobileRegistrationError,
      requestMobilePermission,
      retryMobileRegistration,
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
      isNativePushSupported,
      isRegisteringMobile,
      mobilePermission,
      mobileRegistrationError,
      openNotification,
      openNotificationAndDismiss,
      registeredToken,
      requestDesktopPermission,
      requestMobilePermission,
      retryMobileRegistration,
    ],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {!isNativeApp() ? (
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
      ) : null}
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
