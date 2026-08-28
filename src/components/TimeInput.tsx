import { useId } from 'react'
import { buildHalfHourTimeSlots } from '../lib/calendar-hours'

interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  /** Include 24:00 (working-day end only). */
  includeEndOfDay?: boolean
}

const defaultSlots = buildHalfHourTimeSlots()

/** 24-hour time dropdown in 30-minute steps. */
export function TimeInput({
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  includeEndOfDay = false,
}: TimeInputProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const slots = includeEndOfDay ? buildHalfHourTimeSlots({ includeEndOfDay: true }) : defaultSlots
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
