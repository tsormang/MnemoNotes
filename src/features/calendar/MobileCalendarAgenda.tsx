import clsx from 'clsx'
import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { useEffect, useMemo, useRef } from 'react'
import { formatShiftStaffLabel } from '../../lib/calendar-display'
import { itemHasShiftConflict } from '../../lib/calendar-conflicts'
import { IconAvatar } from '../../components/icons/IconAvatar'
import { defaultIconIdForKind } from '../../lib/icons/defaults'
import type { CalendarItem, CalendarItemKind, Personnel } from '../../types/domain'
import { attachEventSeriesMenuTriggers } from './EventSeriesMenu'

const kindLabels: Record<CalendarItemKind, string> = {
  shift: 'Shift',
  note: 'Note',
  task: 'Task',
}

function itemOverlapsDay(item: CalendarItem, day: Date): boolean {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  return start <= dayEnd && end >= dayStart
}

function formatEventTime(item: CalendarItem): string {
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
}

function MobileAgendaCard({
  item,
  personnel,
  hasConflict,
  canOpenSeriesMenu,
  onOpenItem,
  onOpenSeriesMenu,
  onSuppressClick,
}: {
  item: CalendarItem
  personnel: Personnel[]
  hasConflict: boolean
  canOpenSeriesMenu: boolean
  onOpenItem: (item: CalendarItem) => void
  onOpenSeriesMenu: (item: CalendarItem, x: number, y: number) => void
  onSuppressClick: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const element = buttonRef.current
    if (!element) return

    return attachEventSeriesMenuTriggers(
      element,
      item,
      canOpenSeriesMenu,
      ({ x, y }) => onOpenSeriesMenu(item, x, y),
      onSuppressClick,
    )
  }, [item, canOpenSeriesMenu, onOpenSeriesMenu, onSuppressClick])

  const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
  const headline =
    item.kind === 'shift' ? formatShiftStaffLabel(assignees) : item.title.trim() || 'Untitled'
  const subtitle =
    item.kind === 'shift'
      ? kindLabels.shift
      : item.noteCategory?.trim() || kindLabels[item.kind]
  const bubbleIconId =
    item.kind === 'shift'
      ? assignees[0]?.iconId
      : item.iconId ?? defaultIconIdForKind(item.kind)
  const bubbleEntityType = item.kind === 'shift' ? 'personnel' : item.kind
  const bubbleLabel = item.kind === 'shift' ? assignees[0]?.fullName : undefined

  return (
    <button
      ref={buttonRef}
      type="button"
      className={clsx(
        'mobile-agenda-card',
        `mobile-agenda-card--${item.kind}`,
        hasConflict && 'mobile-agenda-card--conflict',
      )}
      onClick={() => onOpenItem(item)}
    >
      {bubbleIconId ? (
        <IconAvatar
          iconId={bubbleIconId}
          entityType={bubbleEntityType}
          label={bubbleLabel}
          size="md"
          className="mobile-agenda-card__avatar"
          initialsFallback={item.kind === 'shift'}
        />
      ) : (
        <span className="mobile-agenda-card__accent" aria-hidden="true" />
      )}
      <span className="mobile-agenda-card__body">
        <strong>{headline}</strong>
        <span className="mobile-agenda-card__time">{formatEventTime(item)}</span>
        <span className="mobile-agenda-card__meta">{subtitle}</span>
      </span>
    </button>
  )
}

export type MobileAgendaMode = 'day' | 'week'

export function MobileCalendarAgenda({
  mode = 'day',
  items,
  allItems,
  personnel,
  selectedDate,
  onSelectDate,
  onOpenItem,
  onOpenSeriesMenu,
  onSuppressItemClick,
  canOpenSeriesMenu,
  canCreate,
  onCreateForDay,
}: {
  mode?: MobileAgendaMode
  items: CalendarItem[]
  allItems: CalendarItem[]
  personnel: Personnel[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onOpenItem: (item: CalendarItem) => void
  onOpenSeriesMenu: (item: CalendarItem, x: number, y: number) => void
  onSuppressItemClick: () => void
  canOpenSeriesMenu: (item: CalendarItem) => boolean
  canCreate: boolean
  onCreateForDay: (date: Date) => void
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      for (const day of weekDays) {
        if (itemOverlapsDay(item, day)) {
          set.add(format(day, 'yyyy-MM-dd'))
        }
      }
    }
    return set
  }, [items, weekDays])

  const dayItems = useMemo(
    () =>
      items
        .filter((item) => itemOverlapsDay(item, selectedDate))
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
    [items, selectedDate],
  )

  const weekSections = useMemo(
    () =>
      weekDays.map((day) => ({
        day,
        items: items
          .filter((item) => itemOverlapsDay(item, day))
          .sort(
            (left, right) =>
              new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
          ),
      })),
    [items, weekDays],
  )

  const dayHeading = (day: Date) =>
    isToday(day) ? `${format(day, 'd MMM')} Today` : format(day, 'EEEE d MMM')

  if (mode === 'week') {
    return (
      <div className="mobile-agenda mobile-agenda--week">
        <div className="mobile-agenda__list">
          {weekSections.map(({ day, items: sectionItems }) => (
            <section key={format(day, 'yyyy-MM-dd')} className="mobile-agenda__day-section">
              <h3 className="mobile-agenda__heading">{dayHeading(day)}</h3>

              {sectionItems.length === 0 ? (
                <p className="mobile-agenda__empty-day">No events scheduled</p>
              ) : (
                <ul className="mobile-agenda__cards">
                  {sectionItems.map((item) => (
                    <li key={item.id}>
                      <MobileAgendaCard
                        item={item}
                        personnel={personnel}
                        hasConflict={itemHasShiftConflict(allItems, item)}
                        canOpenSeriesMenu={canOpenSeriesMenu(item)}
                        onOpenItem={onOpenItem}
                        onOpenSeriesMenu={onOpenSeriesMenu}
                        onSuppressClick={onSuppressItemClick}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    )
  }

  const selectedDayHeading = dayHeading(selectedDate)

  return (
    <div className="mobile-agenda">
      <div className="mobile-agenda__strip" role="tablist" aria-label="Select day">
        {weekDays.map((day) => {
          const selected = isSameDay(day, selectedDate)
          const key = format(day, 'yyyy-MM-dd')
          const hasEvents = daysWithEvents.has(key)

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={clsx('mobile-agenda__day', selected && 'is-selected')}
              onClick={() => onSelectDate(day)}
            >
              <span className="mobile-agenda__weekday">{format(day, 'EEE')}</span>
              <span className="mobile-agenda__date">{format(day, 'd')}</span>
              {hasEvents ? <span className="mobile-agenda__dot" aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>

      <div className="mobile-agenda__handle" aria-hidden="true" />

      <div className="mobile-agenda__list">
        <h3 className="mobile-agenda__heading">{selectedDayHeading}</h3>

        {dayItems.length === 0 ? (
          <div className="mobile-agenda__empty">
            <p>No events scheduled</p>
            {canCreate ? (
              <button
                type="button"
                className="icon-button"
                onClick={() => onCreateForDay(selectedDate)}
              >
                Add event
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="mobile-agenda__cards">
            {dayItems.map((item) => (
              <li key={item.id}>
                <MobileAgendaCard
                  item={item}
                  personnel={personnel}
                  hasConflict={itemHasShiftConflict(allItems, item)}
                  canOpenSeriesMenu={canOpenSeriesMenu(item)}
                  onOpenItem={onOpenItem}
                  onOpenSeriesMenu={onOpenSeriesMenu}
                  onSuppressClick={onSuppressItemClick}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
