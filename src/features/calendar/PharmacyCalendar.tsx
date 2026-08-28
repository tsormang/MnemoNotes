import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, MoonStar } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '../auth/WorkspaceProvider'
import {
  FULL_DAY_END,
  FULL_DAY_START,
  formatClockLabel,
  getWeekStartKey,
  toSlotTime,
} from '../../lib/calendar-hours'
import {
  useCalendarItems,
  useOrganization,
  usePersonnelList,
  useWeekOverrides,
} from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { CalendarItem, CalendarItemKind, Personnel } from '../../types/domain'

const time24h = {
  hour: '2-digit' as const,
  minute: '2-digit' as const,
  hour12: false,
}

const eventClassNames: Record<CalendarItemKind, string> = {
  shift: 'event-shift',
  note: 'event-note',
  task: 'event-task',
}

const calendarViews = [
  { id: 'timeGridDay', label: 'Day' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'dayGridMonth', label: 'Month' },
] as const

type CalendarViewId = (typeof calendarViews)[number]['id']

function getInitialView(): CalendarViewId {
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
  personnel,
}: {
  title: string
  allDay: boolean
  start: Date | null
  end: Date | null
  item: CalendarItem
  personnel: Personnel[]
}) {
  const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
  const timeLabel =
    allDay || !start
      ? null
      : `${format(start, 'HH:mm')}${end ? ` – ${format(end, 'HH:mm')}` : ''}`

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

function CalendarUtilityRibbon({
  title,
  activeView,
  nightShiftEnabled,
  nightShiftHint,
  onPrev,
  onNext,
  onToday,
  onChangeView,
  onToggleNightShift,
}: {
  title: string
  activeView: CalendarViewId
  nightShiftEnabled: boolean
  nightShiftHint: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onChangeView: (view: CalendarViewId) => void
  onToggleNightShift: () => void
}) {
  const nightShiftLabel = nightShiftEnabled
    ? `Night shifts on · ${nightShiftHint}`
    : `Night shifts off · ${nightShiftHint}`

  return (
    <div className="calendar-utility-ribbon" role="toolbar" aria-label="Calendar utility ribbon">
      <div className="calendar-utility-ribbon__nav">
        <button type="button" className="calendar-ribbon-btn" aria-label="Previous" onClick={onPrev}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="calendar-ribbon-btn" aria-label="Next" onClick={onNext}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="calendar-ribbon-btn calendar-ribbon-btn--label" onClick={onToday}>
          Today
        </button>
      </div>

      <h2 className="calendar-utility-ribbon__title">{title}</h2>

      <div className="calendar-utility-ribbon__tools">
        <button
          type="button"
          className={clsx('calendar-ribbon-toggle', nightShiftEnabled && 'is-active')}
          aria-pressed={nightShiftEnabled}
          aria-label={nightShiftLabel}
          title={nightShiftLabel}
          onClick={onToggleNightShift}
        >
          <MoonStar size={18} aria-hidden="true" />
        </button>

        <div className="calendar-view-switch" role="group" aria-label="Calendar view">
          {calendarViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className={clsx('calendar-ribbon-btn', activeView === view.id && 'is-active')}
              aria-pressed={activeView === view.id}
              onClick={() => onChangeView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PharmacyCalendar() {
  const { organizationId, can } = useWorkspace()
  const orgQuery = useOrganization(organizationId)
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const weekOverridesQuery = useWeekOverrides(organizationId)
  const queryClient = useQueryClient()

  const calendarRef = useRef<FullCalendar>(null)
  const [initialView] = useState(getInitialView)
  const [activeView, setActiveView] = useState<CalendarViewId>(initialView)
  const [visibleDate, setVisibleDate] = useState(() => new Date())
  const [viewTitle, setViewTitle] = useState('Calendar')
  const [weekStartKey, setWeekStartKey] = useState(() => getWeekStartKey(new Date()))

  const workingDayStart = orgQuery.data?.workingDayStart ?? '07:00'
  const workingDayEnd = orgQuery.data?.workingDayEnd ?? '21:00'
  const nightShiftWeeks = weekOverridesQuery.data ?? {}
  const nightShiftEnabled = Boolean(nightShiftWeeks[weekStartKey])

  const nightShiftMutation = useMutation({
    mutationFn: async ({ weekKey, enabled }: { weekKey: string; enabled: boolean }) => {
      if (!organizationId || !supabase) return

      if (enabled) {
        const { error } = await supabase.from('calendar_week_overrides').upsert(
          {
            organization_id: organizationId,
            week_start_date: weekKey,
            show_all_hours: true,
          },
          { onConflict: 'organization_id,week_start_date' },
        )
        if (error) throw error
        return
      }

      const { error } = await supabase
        .from('calendar_week_overrides')
        .delete()
        .eq('organization_id', organizationId)
        .eq('week_start_date', weekKey)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['week-overrides', organizationId] })
    },
  })

  const nightShiftHint = nightShiftEnabled
    ? `${formatClockLabel(FULL_DAY_START)} – ${formatClockLabel(FULL_DAY_END)}`
    : `${formatClockLabel(workingDayStart)} – ${formatClockLabel(workingDayEnd)}`

  const slotMinTime = toSlotTime(nightShiftEnabled ? FULL_DAY_START : workingDayStart)
  const slotMaxTime = toSlotTime(nightShiftEnabled ? FULL_DAY_END : workingDayEnd)
  const scrollTime = toSlotTime(nightShiftEnabled ? FULL_DAY_START : workingDayStart)

  const personnel = personnelQuery.data ?? []
  const calendarItems = calendarQuery.data ?? []

  const events = useMemo(
    () =>
      calendarItems.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.startsAt,
        end: item.endsAt,
        classNames: [eventClassNames[item.kind as CalendarItemKind]],
        extendedProps: item,
      })),
    [calendarItems],
  )

  const getApi = () => calendarRef.current?.getApi()
  const canEditCalendar = false

  const handleDatesSet = (arg: {
    view: { type: string; title: string; currentStart: Date }
  }) => {
    setActiveView(arg.view.type as CalendarViewId)
    setVisibleDate(arg.view.currentStart)
    setViewTitle(arg.view.title)
    setWeekStartKey(getWeekStartKey(arg.view.currentStart))
  }

  const handleToggleNightShift = () => {
    if (!isSupabaseConfigured || !can('organization.update')) return
    nightShiftMutation.mutate({ weekKey: weekStartKey, enabled: !nightShiftEnabled })
  }

  return (
    <div className="calendar-fill" aria-label="Pharmacy operations calendar">
      <CalendarUtilityRibbon
        title={viewTitle}
        activeView={activeView}
        nightShiftEnabled={nightShiftEnabled}
        nightShiftHint={nightShiftHint}
        onPrev={() => getApi()?.prev()}
        onNext={() => getApi()?.next()}
        onToday={() => getApi()?.today()}
        onChangeView={(view) => getApi()?.changeView(view)}
        onToggleNightShift={handleToggleNightShift}
      />

      <FullCalendar
        key={`${slotMinTime}-${slotMaxTime}`}
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={activeView}
        initialDate={visibleDate}
        headerToolbar={false}
        locale="en-GB"
        eventTimeFormat={time24h}
        slotLabelFormat={time24h}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        scrollTime={scrollTime}
        nowIndicator
        editable={canEditCalendar}
        selectable={canEditCalendar}
        height="100%"
        events={events}
        dayMaxEvents={3}
        datesSet={handleDatesSet}
        eventContent={(arg) => (
          <EventChip
            title={arg.event.title}
            allDay={arg.event.allDay}
            start={arg.event.start}
            end={arg.event.end}
            item={arg.event.extendedProps as CalendarItem}
            personnel={personnel}
          />
        )}
        windowResize={() => {
          calendarRef.current?.getApi().updateSize()
        }}
      />
    </div>
  )
}
