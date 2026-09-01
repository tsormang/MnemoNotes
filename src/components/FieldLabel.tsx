import type { ReactNode } from 'react'

interface FieldLabelProps {
  children: ReactNode
  required?: boolean
}

export function FieldLabel({ children, required = false }: FieldLabelProps) {
  return (
    <span className="field-label">
      {children}
      {required ? (
        <span className="field-label__required" aria-hidden="true">
          {' *'}
        </span>
      ) : null}
    </span>
  )
}
