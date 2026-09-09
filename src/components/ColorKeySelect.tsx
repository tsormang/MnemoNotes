import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FieldLabel } from './FieldLabel'
import {
  ENTITY_COLOR_KEYS,
  ENTITY_COLOR_PALETTE,
  isEntityColorKey,
  type EntityColorKey,
} from '../lib/entity-colors'

export interface ColorKeySelectProps {
  value: string
  onChange: (colorKey: EntityColorKey | '') => void
  disabled?: boolean
  label?: string
  required?: boolean
  /** When true, include an empty “auto / random” option (create forms). */
  allowEmpty?: boolean
  compact?: boolean
  'aria-label'?: string
}

export function ColorKeySelect({
  value,
  onChange,
  disabled = false,
  label,
  required = false,
  allowEmpty = false,
  compact = false,
  'aria-label': ariaLabel,
}: ColorKeySelectProps) {
  const { t } = useTranslation('people')
  const listboxId = useId()
  const controlRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const selectedKey = isEntityColorKey(value) ? value : null
  const selectedColors = selectedKey ? ENTITY_COLOR_PALETTE[selectedKey] : null
  const selectedLabel = selectedKey
    ? t(`colors.${selectedKey}`)
    : allowEmpty
      ? t('colors.auto')
      : t('colors.choose')

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const pick = (next: EntityColorKey | '') => {
    onChange(next)
    setOpen(false)
  }

  const resolvedLabel = label ?? t('colors.label')

  return (
    <div
      className={clsx('color-key-select', compact && 'color-key-select--compact')}
      ref={controlRef}
    >
      {!compact ? (
        <span className="color-key-select__label" id={`${listboxId}-label`}>
          <FieldLabel required={required}>{resolvedLabel}</FieldLabel>
        </span>
      ) : null}
      <button
        type="button"
        className={clsx('color-key-select__trigger', compact && 'inline-select')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={compact ? undefined : `${listboxId}-label`}
        aria-label={compact ? ariaLabel ?? resolvedLabel : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="color-key-select__swatch"
          style={
            selectedColors
              ? {
                  backgroundColor: selectedColors.bg,
                  borderColor: selectedColors.border,
                }
              : undefined
          }
          aria-hidden="true"
        />
        <span className="color-key-select__name">{selectedLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={clsx(open && 'color-key-select__chevron--open')}
        />
      </button>
      {open ? (
        <div
          className="color-key-select__panel"
          role="listbox"
          id={listboxId}
          aria-labelledby={compact ? undefined : `${listboxId}-label`}
          aria-label={compact ? ariaLabel ?? resolvedLabel : undefined}
        >
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              aria-selected={!selectedKey}
              className={clsx(
                'color-key-select__option',
                !selectedKey && 'color-key-select__option--selected',
              )}
              onClick={() => pick('')}
            >
              <span className="color-key-select__swatch color-key-select__swatch--empty" aria-hidden="true" />
              <span>{t('colors.auto')}</span>
            </button>
          ) : null}
          {ENTITY_COLOR_KEYS.map((key) => {
            const colors = ENTITY_COLOR_PALETTE[key]
            const selected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                className={clsx(
                  'color-key-select__option',
                  selected && 'color-key-select__option--selected',
                )}
                onClick={() => pick(key)}
              >
                <span
                  className="color-key-select__swatch"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  aria-hidden="true"
                />
                <span>{t(`colors.${key}`)}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Read-only swatch for cards / lists. */
export function ColorKeySwatch({
  colorKey,
  title,
  className,
}: {
  colorKey: string
  title?: string
  className?: string
}) {
  const colors = isEntityColorKey(colorKey)
    ? ENTITY_COLOR_PALETTE[colorKey]
    : ENTITY_COLOR_PALETTE.blue

  return (
    <span
      className={clsx('color-key-swatch', className)}
      title={title}
      aria-hidden={title ? undefined : true}
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    />
  )
}
