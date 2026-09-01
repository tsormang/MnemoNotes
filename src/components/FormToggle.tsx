import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function ToggleCheckmark() {
  return (
    <span className="toggle-mark" aria-hidden="true">
      <Check size={14} strokeWidth={3} />
    </span>
  )
}

interface FormToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  block?: boolean
  children: ReactNode
}

export function FormToggle({
  pressed,
  block = false,
  className,
  children,
  type = 'button',
  ...props
}: FormToggleProps) {
  return (
    <button
      type={type}
      className={clsx('form-toggle', block && 'form-toggle--block', pressed && 'is-active', className)}
      aria-pressed={pressed}
      {...props}
    >
      {pressed ? <ToggleCheckmark /> : null}
      <span className="form-toggle__label">{children}</span>
    </button>
  )
}

interface ToggleOptionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  children: ReactNode
}

export function ToggleOption({ pressed, className, children, type = 'button', ...props }: ToggleOptionProps) {
  return (
    <button
      type={type}
      className={clsx('toggle-option', pressed && 'is-active', className)}
      aria-pressed={pressed}
      {...props}
    >
      {pressed ? <ToggleCheckmark /> : <span className="toggle-mark toggle-mark--placeholder" aria-hidden="true" />}
      <span className="toggle-option__label">{children}</span>
    </button>
  )
}
