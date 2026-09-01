import { useTranslation } from 'react-i18next'
import { FormToggle, ToggleOption } from './FormToggle'
import {
  formatOffsetLabel,
  normalizeNotificationOffsets,
  NOTIFICATION_OFFSET_PRESETS,
} from '../lib/notification-schedule'

interface NotificationOffsetPickerProps {
  offsets: number[]
  useCustom: boolean
  disabled?: boolean
  onOffsetsChange: (offsets: number[]) => void
  onUseCustomChange: (useCustom: boolean) => void
}

export function NotificationOffsetPicker({
  offsets,
  useCustom,
  disabled = false,
  onOffsetsChange,
  onUseCustomChange,
}: NotificationOffsetPickerProps) {
  const { t } = useTranslation('calendar')

  const toggleOffset = (preset: number) => {
    const next = offsets.includes(preset)
      ? offsets.filter((value) => value !== preset)
      : normalizeNotificationOffsets([...offsets, preset])
    onOffsetsChange(next)
  }

  return (
    <fieldset className="notification-offset-picker">
      <legend>{t('reminders.legend')}</legend>
      <FormToggle
        block
        pressed={useCustom}
        disabled={disabled}
        onClick={() => onUseCustomChange(!useCustom)}
      >
        {t('reminders.customToggle')}
      </FormToggle>
      {useCustom ? (
        <div className="toggle-option-list" role="group" aria-label={t('reminders.groupAria')}>
          {NOTIFICATION_OFFSET_PRESETS.map((preset) => {
            const selected = offsets.includes(preset)
            return (
              <ToggleOption
                key={preset}
                pressed={selected}
                disabled={disabled}
                onClick={() => toggleOffset(preset)}
              >
                {formatOffsetLabel(preset)}
              </ToggleOption>
            )
          })}
        </div>
      ) : (
        <p className="modal-hint">{t('reminders.useDefaults')}</p>
      )}
    </fieldset>
  )
}
