import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { useCan } from '../auth/WorkspaceProvider'
import { DisplayPreferencesSettings } from './DisplayPreferencesSettings'
import { LanguageSettings } from './LanguageSettings'
import { NotificationDefaultsSettings } from './NotificationDefaultsSettings'
import { WorkingDaySettings } from './WorkingDaySettings'

export function UserSecurityScreen() {
  const { t } = useTranslation('settings')
  const canManageRoles = useCan('roles.manage')

  return (
    <section className="content-section content-section--embedded">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">{t('configuration.eyebrow')}</p>
          <h1>{t('configuration.title')}</h1>
        </div>
      </div>

      <LanguageSettings compact />
      <DisplayPreferencesSettings compact />
      <WorkingDaySettings compact />
      <NotificationDefaultsSettings compact />

      {canManageRoles ? (
        <p className="modal-hint">
          <Trans
            i18nKey="configuration.rolesHint"
            ns="settings"
            components={{
              1: <Link to="/app/people" />,
            }}
          />
        </p>
      ) : null}
    </section>
  )
}
