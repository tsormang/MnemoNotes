export const SUPPORTED_LOCALES = ['el', 'en'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'el'

export const LOCALE_LABELS: Record<AppLocale, string> = {
  el: 'Ελληνικά',
  en: 'English',
}

/** BCP 47 tag for `<html lang>` and Intl APIs. */
export function localeToBcp47(locale: AppLocale): string {
  return locale === 'el' ? 'el-GR' : 'en-GB'
}

/** FullCalendar locale id. */
export function localeToFullCalendar(locale: AppLocale): string {
  return locale === 'el' ? 'el' : 'en-gb'
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'el' || value === 'en'
}
