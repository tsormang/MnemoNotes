import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE, isAppLocale, localeToBcp47, type AppLocale } from './types'

import elAuth from './locales/el/auth.json'
import elCalendar from './locales/el/calendar.json'
import elCommon from './locales/el/common.json'
import elNotifications from './locales/el/notifications.json'
import elPeople from './locales/el/people.json'
import elSettings from './locales/el/settings.json'
import elValidation from './locales/el/validation.json'

import enAuth from './locales/en/auth.json'
import enCalendar from './locales/en/calendar.json'
import enCommon from './locales/en/common.json'
import enNotifications from './locales/en/notifications.json'
import enPeople from './locales/en/people.json'
import enSettings from './locales/en/settings.json'
import enValidation from './locales/en/validation.json'

export const I18N_NAMESPACES = [
  'common',
  'auth',
  'settings',
  'validation',
  'calendar',
  'people',
  'notifications',
] as const

export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

const resources = {
  el: {
    common: elCommon,
    auth: elAuth,
    settings: elSettings,
    validation: elValidation,
    calendar: elCalendar,
    people: elPeople,
    notifications: elNotifications,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    settings: enSettings,
    validation: enValidation,
    calendar: enCalendar,
    people: enPeople,
    notifications: enNotifications,
  },
} as const

export function applyDocumentLocale(locale: AppLocale) {
  document.documentElement.lang = localeToBcp47(locale)
}

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem('mnemonotes-locale')
    if (!raw) return DEFAULT_LOCALE
    const parsed = JSON.parse(raw) as { state?: { locale?: string } }
    return isAppLocale(parsed.state?.locale) ? parsed.state.locale : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

const initialLocale = readStoredLocale()
applyDocumentLocale(initialLocale)

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: ['el', 'en'],
  defaultNS: 'common',
  ns: [...I18N_NAMESPACES],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

export default i18n
