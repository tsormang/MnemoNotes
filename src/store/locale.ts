import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '../i18n/types'

interface LocaleState {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'mnemonotes-locale',
      partialize: (state) => ({ locale: state.locale }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<LocaleState> | undefined
        const locale = isAppLocale(stored?.locale) ? stored.locale : DEFAULT_LOCALE
        return { ...current, locale }
      },
    },
  ),
)
