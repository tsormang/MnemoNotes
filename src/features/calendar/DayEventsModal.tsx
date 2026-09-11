import { endOfDay, startOfDay } from 'date-fns'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { itemHasShiftConflict } from '../../lib/calendar-conflicts'
import { buildPersonnelBubbleColorMap } from '../../lib/calendar-bubble-colors'
import { localeToBcp47 } from '../../i18n/types'
import { useLocaleStore } from '../../store/locale'
import type { CalendarItem, Personnel } from '../../types/domain'
import { MobileAgendaCard } from './MobileCalendarAgenda'

interface DayEventsModalProps {
  date: Date | null
  items: CalendarItem[]
  allItems: CalendarItem[]
  personnel: Personnel[]
  onClose: () => void
  onOpenItem: (item: CalendarItem) => void
  onOpenSeriesMenu: (item: CalendarItem, x: number, y: number) => void
  onSuppressItemClick: () => void
  canOpenSeriesMenu: (item: CalendarItem) => boolean
}

function itemOverlapsDay(item: CalendarItem, day: Date): boolean {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  return start <= dayEnd && end >= dayStart
}

function formatDayTitle(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
}

export function DayEventsModal({
  date,
  items,
  allItems,
  personnel,
  onClose,
  onOpenItem,
  onOpenSeriesMenu,
  onSuppressItemClick,
  canOpenSeriesMenu,
}: DayEventsModalProps) {
  const { t } = useTranslation('calendar')
  const locale = useLocaleStore((state) => state.locale)
  const personnelBubbleColors = useMemo(
    () => buildPersonnelBubbleColorMap(personnel),
    [personnel],
  )

  const dayItems = useMemo(() => {
    if (!date) return []
    return items
      .filter((item) => itemOverlapsDay(item, date))
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
  }, [items, date])

  const title = date ? formatDayTitle(date, localeToBcp47(locale)) : t('view.defaultTitle')

  return (
    <Modal open={date != null} onClose={onClose} title={title}>
      {dayItems.length === 0 ? (
        <p className="page-hint">{t('agenda.emptyDay')}</p>
      ) : (
        <ul className="day-events-modal__list">
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
                personnelColors={personnelBubbleColors}
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
