import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { format } from 'date-fns'
import { useMemo, useRef, useState } from 'react'
import { calendarItems, personnel } from '../../data/demo'
import type { CalendarItem, CalendarItemKind } from '../../types/domain'

const eventClassNames: Record<CalendarItemKind, string> = {
  shift: 'event-shift',
  note: 'event-note',
  task: 'event-task',
}

function getInitialView() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
    return 'timeGridDay'
  }
  return 'dayGridMonth'
}

function EventChip({
  title,
  allDay,
  start,
  end,
  item,
}: {
  title: string
  allDay: boolean
  start: Date | null
  end: Date | null
  item: CalendarItem
}) {
  const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
  const timeLabel =
    allDay || !start
      ? null
      : `${format(start, 'HH:mm')}${end ? ` - ${format(end, 'HH:mm')}` : ''}`

  return (
    <div className="fc-event-chip">
      {assignees[0] ? (
        <span className="fc-event-avatar" aria-hidden="true">
          {assignees[0].fullName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </span>
      ) : null}
      <div className="fc-event-text">
        <strong>{title}</strong>
        {timeLabel ? <span>{timeLabel}</span> : null}
      </div>
    </div>
  )
}

export function PharmacyCalendar() {
  const calendarRef = useRef<FullCalendar>(null)
  const [initialView] = useState(getInitialView)

  const events = useMemo(
    () =>
      calendarItems.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.startsAt,
        end: item.endsAt,
        classNames: [eventClassNames[item.kind]],
        extendedProps: item,
      })),
    [],
  )

  return (
    <div className="calendar-fill" aria-label="Pharmacy operations calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridDay,timeGridWeek,dayGridMonth',
        }}
        buttonText={{
          today: 'Today',
          day: 'Day',
          week: 'Week',
          month: 'Month',
        }}
        nowIndicator
        editable
        selectable
        height="100%"
        events={events}
        dayMaxEvents={3}
        eventContent={(arg) => (
          <EventChip
            title={arg.event.title}
            allDay={arg.event.allDay}
            start={arg.event.start}
            end={arg.event.end}
            item={arg.event.extendedProps as CalendarItem}
          />
        )}
        windowResize={() => {
          calendarRef.current?.getApi().updateSize()
        }}
      />
    </div>
  )
}
