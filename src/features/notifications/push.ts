import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import { getNativePlatform, isNativeApp } from '../../lib/capacitor'
import { isSupabaseConfigured } from '../../lib/supabase'

export type MobilePushPermission = 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface PushDeepLinkPayload {
  calendarItemId: string
  jobId?: string
}

interface UseNativePushNotificationsOptions {
  organizationId: string | null
  userId: string | null
  onDeepLink: (payload: PushDeepLinkPayload) => void
  onForegroundPush?: (payload: PushDeepLinkPayload) => void
}

export function useNativePushNotifications({
  organizationId,
  userId,
  onDeepLink,
  onForegroundPush,
}: UseNativePushNotificationsOptions) {
  const [permission, setPermission] = useState<MobilePushPermission>('unsupported')
  const [registeredToken, setRegisteredToken] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const listenersReadyRef = useRef<Promise<void> | null>(null)

  const registerToken = useCallback(
    async (token: string) => {
      if (!organizationId || !isSupabaseConfigured) return

      setIsRegistering(true)
      setRegistrationError(null)

      try {
        await invokeEdgeFunction('register-device', {
          action: 'register',
          token,
          platform: getNativePlatform(),
          channel: 'fcm',
          organizationId,
        })
        tokenRef.current = token
        setRegisteredToken(token)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Device registration failed.'
        setRegistrationError(message)
        throw error
      } finally {
        setIsRegistering(false)
      }
    },
    [organizationId],
  )

  const unregisterToken = useCallback(async () => {
    const token = tokenRef.current
    if (!token || !isSupabaseConfigured) return

    try {
      await invokeEdgeFunction('register-device', {
        action: 'unregister',
        token,
      })
    } finally {
      tokenRef.current = null
      setRegisteredToken(null)
    }
  }, [])

  const registerForPush = useCallback(async () => {
    if (!isNativeApp()) return

    await listenersReadyRef.current
    setRegistrationError(null)
    setIsRegistering(true)

    try {
      await PushNotifications.register()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push registration failed.'
      setRegistrationError(message)
      setIsRegistering(false)
    }
  }, [])

  const requestMobilePermission = useCallback(async () => {
    if (!isNativeApp()) {
      setPermission('unsupported')
      return 'unsupported' as const
    }

    await listenersReadyRef.current

    const result = await PushNotifications.requestPermissions()
    const next =
      result.receive === 'granted'
        ? 'granted'
        : result.receive === 'denied'
          ? 'denied'
          : 'prompt'

    setPermission(next)

    if (next === 'granted') {
      await registerForPush()
    }

    return next
  }, [registerForPush])

  useEffect(() => {
    if (!isNativeApp() || !organizationId || !userId) {
      setPermission(isNativeApp() ? 'prompt' : 'unsupported')
      return
    }

    let cancelled = false

    const handleRegistration = (event: Token) => {
      if (cancelled) return
      void registerToken(event.value).catch(() => {
        /* error state set in registerToken */
      })
    }

    const handleRegistrationError = (error: { error?: string } | unknown) => {
      if (cancelled) return
      const message =
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof error.error === 'string'
          ? error.error
          : 'Push registration failed. Rebuild the APK with android/app/google-services.json.'
      setRegistrationError(message)
      setIsRegistering(false)
      console.warn('Push registration failed', error)
    }

    const parsePayload = (
      notification: PushNotificationSchema | ActionPerformed['notification'],
    ): PushDeepLinkPayload | null => {
      const calendarItemId = notification.data?.calendarItemId
      if (!calendarItemId) return null
      return {
        calendarItemId,
        jobId: notification.data?.jobId,
      }
    }

    const handleReceived = (notification: PushNotificationSchema) => {
      const payload = parsePayload(notification)
      if (payload) onForegroundPush?.(payload)
    }

    const handleAction = (event: ActionPerformed) => {
      const payload = parsePayload(event.notification)
      if (payload) onDeepLink(payload)
    }

    listenersReadyRef.current = (async () => {
      await PushNotifications.addListener('registration', handleRegistration)
      await PushNotifications.addListener('registrationError', handleRegistrationError)
      await PushNotifications.addListener('pushNotificationReceived', handleReceived)
      await PushNotifications.addListener('pushNotificationActionPerformed', handleAction)
    })()

    void listenersReadyRef.current.then(async () => {
      if (cancelled) return

      const result = await PushNotifications.checkPermissions()
      const next =
        result.receive === 'granted'
          ? 'granted'
          : result.receive === 'denied'
            ? 'denied'
            : 'prompt'

      setPermission(next)

      if (next === 'granted' && !tokenRef.current) {
        await registerForPush()
      }
    })

    void CapacitorApp.addListener('appUrlOpen', () => {
      // Reserved for custom URL schemes if added later.
    })

    return () => {
      cancelled = true
      listenersReadyRef.current = null
      void PushNotifications.removeAllListeners()
    }
  }, [onDeepLink, onForegroundPush, organizationId, registerForPush, registerToken, userId])

  useEffect(() => {
    if (!userId) {
      void unregisterToken()
    }
  }, [unregisterToken, userId])

  return {
    isNativePushSupported: isNativeApp(),
    mobilePermission: permission,
    registeredToken,
    isRegisteringMobile: isRegistering,
    mobileRegistrationError: registrationError,
    requestMobilePermission,
    retryMobileRegistration: registerForPush,
    unregisterToken,
  }
}
