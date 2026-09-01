export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false

  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor

  return Boolean(capacitor?.isNativePlatform?.())
}

export function getNativePlatform(): 'android' | 'ios' | 'web' {
  if (!isNativeApp()) return 'web'

  const capacitor = (window as Window & {
    Capacitor?: { getPlatform?: () => string }
  }).Capacitor

  const platform = capacitor?.getPlatform?.()
  if (platform === 'android' || platform === 'ios') return platform
  return 'web'
}
