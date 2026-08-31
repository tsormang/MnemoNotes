import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import type { PropsWithChildren } from 'react'
import i18n, { applyDocumentLocale } from './index'
import { useLocaleStore } from '../store/locale'

function LocaleSync() {
  const locale = useLocaleStore((state) => state.locale)

  useEffect(() => {
    void i18n.changeLanguage(locale)
    applyDocumentLocale(locale)
  }, [locale])

  return null
}

export function I18nProvider({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleSync />
      {children}
    </I18nextProvider>
  )
}
