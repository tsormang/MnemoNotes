interface CompanyLocationFieldProps {
  companyName: string
  loading?: boolean
}

/** Readonly company field — location is always the org's primary site. */
export function CompanyLocationField({ companyName, loading }: CompanyLocationFieldProps) {
  return (
    <label>
      Company
      <input
        type="text"
        className="field-readonly"
        value={loading ? 'Loading…' : companyName}
        readOnly
        aria-readonly="true"
      />
    </label>
  )
}
