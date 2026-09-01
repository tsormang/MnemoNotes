import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type AppLocale } from '../../i18n/types'
import { useLocaleStore } from '../../store/locale'

interface LanguageSettingsProps {
  compact?: boolean
}

export function LanguageSettings({ compact = false }: LanguageSettingsProps) {
  const { t } = useTranslation('settings')
  const locale = useLocaleStore((state) => state.locale)
  const setLocale = useLocaleStore((state) => state.setLocale)

  return (
    <section className={`language-settings${compact ? ' language-settings--compact' : ''}`}>
      <div className="language-settings__heading">
        <div className="language-settings__icon" aria-hidden="true">
          <Languages size={18} />
        </div>
        <div>
          <h2>{t('language.title')}</h2>
          <p>{t('language.description')}</p>
        </div>
      </div>

      <div className="language-settings__control">
        <label htmlFor="display-language">{t('language.label')}</label>
        <select
          id="display-language"
          className="form-select"
          value={locale}
          onChange={(event) => setLocale(event.target.value as AppLocale)}
        >
          {SUPPORTED_LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
