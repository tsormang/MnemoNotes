import { useTranslation } from 'react-i18next'

interface CompanyLocationFieldProps {
  companyName: string
  loading?: boolean
}

/** Workspace company shown as read-only context — location is always the org's primary site. */
export function CompanyLocationField({ companyName, loading }: CompanyLocationFieldProps) {
  const { t } = useTranslation(['people', 'common'])

  return (
    <p className="company-field-info">
      <span className="company-field-info__label">{t('people:companyField.label')}</span>
      <span className="company-field-info__value">
        {loading ? t('common:loading') : companyName}
      </span>
    </p>
  )
}
