import { addDays, endOfMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { FieldLabel } from '../../components/FieldLabel'
import { IconAvatar } from '../../components/icons/IconAvatar'
import {
  buildPersonnelBubbleColorMap,
  getCalendarBubbleColors,
} from '../../lib/calendar-bubble-colors'
import {
  buildShiftOverlapDiagram,
  formatShiftOverlapDayLabel,
  shiftOverlapDayKey,
} from '../../lib/calendar-shift-overlap'
import { localeToBcp47 } from '../../i18n/types'
import { useLocaleStore } from '../../store/locale'
import type { CalendarItem, Personnel } from '../../types/domain'

export type ShiftOverlapDaySelectScope = 'week' | 'month'

interface ShiftOverlapDiagramModalProps {
  open: boolean
  date: Date
  /** Week: Mon–Sun of focused week. Month: every day in the focused month. */
  daySelectScope?: ShiftOverlapDaySelectScope | null
  items: CalendarItem[]
  personnel: Personnel[]
  windowStart: string
  windowEnd: string
  onClose: () => void
  onOpenItem: (item: CalendarItem) => void
}

interface DaySelectOption {
  key: string
  date: Date
  label: string
}

function buildWeekDayOptions(anchor: Date, locale: string): DaySelectOption[] {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index)
    return {
      key: shiftOverlapDayKey(day),
      date: day,
      label: new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(day),
    }
  })
}

function buildMonthDayOptions(anchor: Date, locale: string): DaySelectOption[] {
  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const dayCount = monthEnd.getDate()
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return Array.from({ length: dayCount }, (_, index) => {
    const day = addDays(monthStart, index)
    return {
      key: shiftOverlapDayKey(day),
      date: day,
      label: formatter.format(day),
    }
  })
}

export function ShiftOverlapDiagramModal({
  open,
  date,
  daySelectScope = null,
  items,
  personnel,
  windowStart,
  windowEnd,
  onClose,
  onOpenItem,
}: ShiftOverlapDiagramModalProps) {
  const { t } = useTranslation('calendar')
  const locale = useLocaleStore((state) => state.locale)
  const bcp47 = localeToBcp47(locale)
  const [selectedDayKey, setSelectedDayKey] = useState(() => shiftOverlapDayKey(date))
  const allowDaySelect = daySelectScope != null

  useEffect(() => {
    if (!open) return
    setSelectedDayKey(shiftOverlapDayKey(date))
  }, [open, date])

  const dayOptions = useMemo(() => {
    if (daySelectScope === 'week') return buildWeekDayOptions(date, bcp47)
    if (daySelectScope === 'month') return buildMonthDayOptions(date, bcp47)
    return []
  }, [daySelectScope, date, bcp47])

  const selectedDate = useMemo(() => {
    if (!allowDaySelect) return date
    const match = dayOptions.find((option) => option.key === selectedDayKey)
    return match?.date ?? date
  }, [allowDaySelect, date, selectedDayKey, dayOptions])

  const personnelById = useMemo(() => {
    const map = new Map<string, Personnel>()
    personnel.forEach((person) => map.set(person.id, person))
    return map
  }, [personnel])

  const personnelColors = useMemo(
    () => buildPersonnelBubbleColorMap(personnel),
    [personnel],
  )

  const itemsById = useMemo(() => {
    const map = new Map<string, CalendarItem>()
    items.forEach((item) => map.set(item.id, item))
    return map
  }, [items])

  const diagram = useMemo(
    () => buildShiftOverlapDiagram(items, selectedDate, windowStart, windowEnd, personnel),
    [items, selectedDate, windowStart, windowEnd, personnel],
  )

  const dayLabel = formatShiftOverlapDayLabel(selectedDate, bcp47)
  const tickStep = diagram.hourTicks.length > 10 ? 2 : 1

  return (
    <Modal open={open} onClose={onClose} title={t('shiftOverlap.title')} wide>
      <div
        className={
          diagram.lanes.length === 0
            ? 'shift-overlap-diagram shift-overlap-diagram--empty'
            : 'shift-overlap-diagram'
        }
      >
        {allowDaySelect ? (
          <label className="shift-overlap-diagram__day-field">
            <FieldLabel>{t('shiftOverlap.selectDay')}</FieldLabel>
            <select
              className="form-select"
              value={selectedDayKey}
              aria-label={t('shiftOverlap.selectDay')}
              onChange={(event) => setSelectedDayKey(event.target.value)}
            >
              {dayOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="shift-overlap-diagram__subtitle">{dayLabel}</p>
        )}

        {diagram.lanes.length === 0 ? (
          <p className="page-hint">{t('shiftOverlap.empty')}</p>
        ) : (
          <div className="shift-overlap-diagram__chart" role="img" aria-label={t('shiftOverlap.title')}>
            <div className="shift-overlap-diagram__axis" aria-hidden="true">
              <div className="shift-overlap-diagram__lane-label" />
              <div className="shift-overlap-diagram__track shift-overlap-diagram__track--axis">
                {diagram.hourTicks.map((tick, index) => {
                  const showLabel = index % tickStep === 0 || index === diagram.hourTicks.length - 1
                  return (
                    <span
                      key={`${tick.minutes}-${tick.label}`}
                      className="shift-overlap-diagram__tick"
                      style={{ left: `${tick.leftPercent}%` }}
                      data-edge={
                        tick.leftPercent <= 0.5 ? 'start' : tick.leftPercent >= 99.5 ? 'end' : undefined
                      }
                    >
                      {showLabel ? tick.label : ''}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="shift-overlap-diagram__lanes">
              {diagram.lanes.map((lane) => {
                const person = lane.personnelId ? personnelById.get(lane.personnelId) : null
                const laneLabel = person?.fullName ?? t('shiftOverlap.unassigned')

                return (
                  <div key={lane.personnelId ?? 'unassigned'} className="shift-overlap-diagram__lane">
                    <div className="shift-overlap-diagram__lane-label" title={laneLabel}>
                      <span>{laneLabel}</span>
                    </div>
                    <div className="shift-overlap-diagram__track">
                      {lane.segments.map((segment) => {
                        const item = itemsById.get(segment.itemId)
                        if (!item) return null
                        const colors = getCalendarBubbleColors(
                          {
                            kind: 'shift',
                            id: item.id,
                            assignedPersonnelIds: segment.personnelId
                              ? [segment.personnelId]
                              : [],
                          },
                          personnelColors,
                        )
                        const timeLabel = `${segment.labelStart} – ${segment.labelEnd}`

                        return (
                          <button
                            key={`${segment.itemId}-${segment.personnelId ?? 'none'}-${segment.startMinutes}`}
                            type="button"
                            className="shift-overlap-diagram__bar"
                            style={{
                              left: `${segment.leftPercent}%`,
                              width: `${Math.max(segment.widthPercent, 1.5)}%`,
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              color: colors.text,
                            }}
                            title={`${laneLabel}: ${timeLabel}`}
                            aria-label={`${laneLabel}: ${timeLabel}`}
                            onClick={() => onOpenItem(item)}
                          >
                            {person ? (
                              <IconAvatar
                                iconId={person.iconId}
                                entityType="personnel"
                                label={person.fullName}
                                size="lg"
                              />
                            ) : null}
                            <span className="shift-overlap-diagram__bar-time">{timeLabel}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
