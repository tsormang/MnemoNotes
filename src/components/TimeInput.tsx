import { useId, useMemo } from 'react'
import { buildTimeSlots, type TimeStepMinutes } from '../lib/calendar-hours'

interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  /** Include 24:00 (working-day end only). */
  includeEndOfDay?: boolean
  /** Dropdown step size in minutes. Defaults to 30 for working-day settings. */
  stepMinutes?: TimeStepMinutes
}

/** 24-hour time dropdown with configurable step size. */
export function TimeInput({
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  includeEndOfDay = false,
  stepMinutes = 30,
}: TimeInputProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const slots = useMemo(
    () => buildTimeSlots(stepMinutes, includeEndOfDay ? { includeEndOfDay: true } : undefined),
    [includeEndOfDay, stepMinutes],
  )
  const selected = slots.includes(value) ? value : slots[0]

  return (
    <select
      id={inputId}
      className="time-input-24"
      aria-label={ariaLabel}
      disabled={disabled}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {slots.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  )
}
