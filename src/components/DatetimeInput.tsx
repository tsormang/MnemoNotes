import { useId } from 'react'
import { combineDateAndTime, splitIsoDatetime } from '../lib/calendar-datetime'
import { snapToHalfHour } from '../lib/calendar-hours'
import { TimeInput } from './TimeInput'

interface DatetimeInputProps {
  value: string | undefined
  onChange: (iso: string) => void
  disabled?: boolean
  dateLabel?: string
  timeLabel?: string
}

/** Date + 24-hour time fields. Avoids locale-dependent native datetime pickers. */
export function DatetimeInput({
  value,
  onChange,
  disabled,
  dateLabel = 'Date',
  timeLabel = 'Time',
}: DatetimeInputProps) {
  const baseId = useId()
  const { date, time } = splitIsoDatetime(value)
  const displayTime = snapToHalfHour(time)

  const update = (nextDate: string, nextTime: string) => {
    if (!nextDate || !nextTime) return
    onChange(combineDateAndTime(nextDate, nextTime))
  }

  return (
    <div className="datetime-input-24">
      <label className="datetime-input-24__date">
        <span className="visually-hidden">{dateLabel}</span>
        <input
          type="date"
          lang="en-GB"
          disabled={disabled}
          value={date}
          onChange={(event) => update(event.target.value, displayTime)}
        />
      </label>
      <TimeInput
        id={`${baseId}-time`}
        aria-label={timeLabel}
        value={displayTime}
        disabled={disabled}
        onChange={(nextTime) => update(date, nextTime)}
      />
    </div>
  )
}
