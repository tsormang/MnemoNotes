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
  const toggleOffset = (preset: number) => {
    const next = offsets.includes(preset)
      ? offsets.filter((value) => value !== preset)
      : normalizeNotificationOffsets([...offsets, preset])
    onOffsetsChange(next)
  }

  return (
    <fieldset className="notification-offset-picker">
      <legend>Reminders</legend>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={useCustom}
          disabled={disabled}
          onChange={(event) => onUseCustomChange(event.target.checked)}
        />
        Custom reminders for this event
      </label>
      {useCustom ? (
        <div className="offset-chip-row" role="group" aria-label="Reminder times">
          {NOTIFICATION_OFFSET_PRESETS.map((preset) => {
            const selected = offsets.includes(preset)
            return (
              <button
                key={preset}
                type="button"
                className={`offset-chip${selected ? ' offset-chip--selected' : ''}`}
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleOffset(preset)}
              >
                {formatOffsetLabel(preset)}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="modal-hint">Uses workspace default reminder times.</p>
      )}
    </fieldset>
  )
}
