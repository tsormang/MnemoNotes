import { ListTodo } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FormToggle } from '../../components/FormToggle'
import { useDisplayPreferences } from '../../store/display-preferences'

interface DisplayPreferencesSettingsProps {
  compact?: boolean
}

export function DisplayPreferencesSettings({ compact = false }: DisplayPreferencesSettingsProps) {
  const { t } = useTranslation('settings')
  const showTasks = useDisplayPreferences((state) => state.showTasks)
  const setShowTasks = useDisplayPreferences((state) => state.setShowTasks)

  return (
    <section className={`display-preferences-settings${compact ? ' display-preferences-settings--compact' : ''}`}>
      <div className="display-preferences-settings__heading">
        <div className="display-preferences-settings__icon" aria-hidden="true">
          <ListTodo size={18} />
        </div>
        <div>
          <h2>{t('display.title')}</h2>
          <p>{t('display.description')}</p>
        </div>
      </div>

      <FormToggle block pressed={showTasks} onClick={() => setShowTasks(!showTasks)}>
        {t('display.showTasks')}
      </FormToggle>
    </section>
  )
}
