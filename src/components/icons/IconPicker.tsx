import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIconCatalog } from '../../lib/queries/icons'
import { defaultPersonnelIconId } from '../../lib/icons/defaults'
import type { AvatarGender, IconEntityType } from '../../lib/icons/types'

export interface IconPickerProps {
  entityType: IconEntityType
  value: string
  onChange: (iconId: string) => void
  disabled?: boolean
  label?: string
  avatarGender?: AvatarGender
  onAvatarGenderChange?: (gender: AvatarGender) => void
}

const genderOptions: Array<{ value: AvatarGender; label: string }> = [
  { value: 'female', label: 'Female avatars' },
  { value: 'male', label: 'Male avatars' },
]

export function IconPicker({
  entityType,
  value,
  onChange,
  disabled = false,
  label = 'Icon',
  avatarGender = 'female',
  onAvatarGenderChange,
}: IconPickerProps) {
  const { iconsFor, defaultIconId } = useIconCatalog()
  const showGenderPicker = entityType === 'personnel' && Boolean(onAvatarGenderChange)
  const options = iconsFor(entityType, showGenderPicker ? avatarGender : undefined)
  const selectedId = value || defaultIconId(entityType, avatarGender)

  return (
    <fieldset className="icon-picker" disabled={disabled}>
      <legend>{label}</legend>
      {showGenderPicker ? (
        <div className="avatar-gender-picker" role="tablist" aria-label="Avatar collection">
          {genderOptions.map((option) => {
            const selected = option.value === avatarGender
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={clsx('avatar-gender-picker__option', selected && 'is-selected')}
                onClick={() => onAvatarGenderChange?.(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="icon-picker__grid" role="radiogroup" aria-label={label}>
        {options.map((icon) => {
          const selected = icon.id === selectedId
          return (
            <button
              key={icon.id}
              type="button"
              className={clsx('icon-picker__option', selected && 'icon-picker__option--selected')}
              aria-pressed={selected}
              aria-label={icon.label}
              title={icon.label}
              onClick={() => onChange(icon.id)}
            >
              <img src={icon.path} alt="" />
            </button>
          )
        })}
      </div>
      {showGenderPicker && options.length === 0 ? (
        <p className="page-hint">No avatars found for this collection.</p>
      ) : null}
    </fieldset>
  )
}

export function AvatarSelectField({
  entityType,
  value,
  onChange,
  disabled = false,
  avatarGender = 'female',
  onAvatarGenderChange,
  iconLabel,
  genderLabel,
}: {
  entityType: IconEntityType
  value: string
  onChange: (iconId: string) => void
  disabled?: boolean
  avatarGender?: AvatarGender
  onAvatarGenderChange?: (gender: AvatarGender) => void
  iconLabel?: string
  genderLabel?: string
}) {
  const { t } = useTranslation(['people', 'common'])
  const resolvedIconLabel =
    iconLabel ?? (entityType === 'personnel' ? t('people:personnel.avatar') : t('common:field.icon'))
  const resolvedGenderLabel = genderLabel ?? t('people:personnel.avatarCollection')
  const listboxId = useId()
  const controlRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { iconsFor, defaultIconId } = useIconCatalog()
  const showGenderPicker = entityType === 'personnel' && Boolean(onAvatarGenderChange)
  const options = iconsFor(entityType, showGenderPicker ? avatarGender : undefined)
  const selectedId = value || defaultIconId(entityType, avatarGender)
  const selectedIcon = options.find((icon) => icon.id === selectedId) ?? options[0]

  useEffect(() => {
    setOpen(false)
  }, [avatarGender, selectedId])

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

  const pickIcon = (iconId: string) => {
    onChange(iconId)
    setOpen(false)
  }

  return (
    <>
      {showGenderPicker ? (
        <label>
          {resolvedGenderLabel}
          <select
            value={avatarGender}
            disabled={disabled}
            onChange={(event) => onAvatarGenderChange?.(event.target.value as AvatarGender)}
          >
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="avatar-icon-select" ref={controlRef}>
        <span className="avatar-icon-select__label" id={`${listboxId}-label`}>
          {resolvedIconLabel}
        </span>
        <button
          type="button"
          className="avatar-icon-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${listboxId}-label`}
          disabled={disabled || !selectedIcon}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="avatar-icon-select__preview">
            {selectedIcon ? <img src={selectedIcon.path} alt="" /> : null}
          </span>
          <ChevronDown size={16} aria-hidden="true" className={clsx(open && 'avatar-icon-select__chevron--open')} />
        </button>
        {open ? (
          <div className="avatar-icon-select__panel" role="listbox" id={listboxId} aria-labelledby={`${listboxId}-label`}>
            <div className="icon-picker__grid">
              {options.map((icon) => {
                const selected = icon.id === selectedId
                return (
                  <button
                    key={icon.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={icon.label}
                    title={icon.label}
                    className={clsx('icon-picker__option', selected && 'icon-picker__option--selected')}
                    onClick={() => pickIcon(icon.id)}
                  >
                    <img src={icon.path} alt="" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export function syncPersonnelIconForGender(
  iconId: string | undefined,
  nextGender: AvatarGender,
  matchesGender: (iconId: string | undefined, gender: AvatarGender) => boolean,
): string {
  if (matchesGender(iconId, nextGender)) {
    return iconId ?? defaultPersonnelIconId(nextGender)
  }
  return defaultPersonnelIconId(nextGender)
}
