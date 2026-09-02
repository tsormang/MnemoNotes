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

interface ToggleSegmentGroupProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export function ToggleSegmentGroup({ children, className, 'aria-label': ariaLabel }: ToggleSegmentGroupProps) {
  return (
    <div className={clsx('toggle-segment-group', className)} role="radiogroup" aria-label={ariaLabel}>
      {children}
    </div>
  )
}

interface ToggleSegmentOptionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  icon?: ReactNode
  children: ReactNode
}

export function ToggleSegmentOption({
  pressed,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ToggleSegmentOptionProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={pressed}
      className={clsx('toggle-segment-option', pressed && 'is-active', className)}
      {...props}
    >
      {icon ? <span className="toggle-segment-option__icon">{icon}</span> : null}
      <span className="toggle-segment-option__label">{children}</span>
    </button>
  )
}
