import { useTranslation } from 'react-i18next'

interface CompanyLocationFieldProps {
  companyName: string
  loading?: boolean
}

/** Readonly company field — location is always the org's primary site. */
export function CompanyLocationField({ companyName, loading }: CompanyLocationFieldProps) {
  const { t } = useTranslation(['people', 'common'])

  return (
    <label>
      {t('people:companyField.label')}
      <input
        type="text"
        className="field-readonly"
        value={loading ? t('common:loading') : companyName}
        readOnly
        aria-readonly="true"
      />
    </label>
  )
}
