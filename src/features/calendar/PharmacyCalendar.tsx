import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import clsx from 'clsx'
import { addDays, format, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, MoonStar } from 'lucide-react'
import { useMemo, useRef, useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import {
  FULL_DAY_END,
  FULL_DAY_START,
  formatClockLabel,
  getWeekStartKey,
  toSlotTime,
} from '../../lib/calendar-hours'
import { formatShiftStaffLabel, getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { itemHasShiftConflict } from '../../lib/calendar-conflicts'
import { defaultEventEnd, normalizeEventRange } from '../../lib/calendar-datetime'
import {
  canCreateAnyCalendarItem,
  canCreateKind,
  canDeleteKind,
  canEditCalendarItem,
} from '../../lib/calendar-permissions'
import {
  useCalendarSeriesActions,
  useUpdateCalendarItemTimes,
  type CalendarSeriesAction,
} from '../../lib/queries/mutations'
import {
  useCalendarItems,
  useOrganization,
  usePersonnelList,
  useWeekOverrides,
} from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { CalendarItem, CalendarItemKind, Personnel } from '../../types/domain'
import { filterCalendarItems, useCalendarShell } from './CalendarShellContext'
import {
  attachEventSeriesMenuTriggers,
  EventSeriesMenu,
  type EventSeriesMenuState,
} from './EventSeriesMenu'

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
  return 'timeGridWeek'
}

function EventChip({
  allDay,
  start,
  end,
  item,
  personnel,
  hasConflict,
}: {
  allDay: boolean
  start: Date | null
  end: Date | null
  item: CalendarItem
  personnel: Personnel[]
  hasConflict: boolean
}) {
  const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
  const headline =
    item.kind === 'shift' ? formatShiftStaffLabel(assignees) : item.title.trim() || 'Untitled'
  const timeLabel =
    allDay || !start
      ? null
      : `${format(start, 'HH:mm')}${end ? ` – ${format(end, 'HH:mm')}` : ''}`

  return (
    <div className={clsx('fc-event-chip', hasConflict && 'fc-event-chip--conflict')}>
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
        <strong>{headline}</strong>
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
  const { user } = useAuth()
  const { organizationId, can } = useWorkspace()
  const { searchQuery, kindFilter, personnelFilterId, openCreateEvent, openEditEvent } =
    useCalendarShell()
  const orgQuery = useOrganization(organizationId)
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const weekOverridesQuery = useWeekOverrides(organizationId)
  const updateTimes = useUpdateCalendarItemTimes(organizationId)
  const seriesActions = useCalendarSeriesActions(organizationId, user?.id ?? null)
  const queryClient = useQueryClient()

  const calendarRef = useRef<FullCalendar>(null)
  const suppressEventClickUntilRef = useRef(0)
  const seriesMenuCleanupRef = useRef(new Map<string, () => void>())
  const [initialView] = useState(getInitialView)
  const [activeView, setActiveView] = useState<CalendarViewId>(initialView)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [visibleRange, setVisibleRange] = useState(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    return { start: weekStart, end: addDays(weekStart, 7) }
  })
  const [viewTitle, setViewTitle] = useState('Calendar')
  const [weekStartKey, setWeekStartKey] = useState(() => getWeekStartKey(new Date()))
  const [seriesMenu, setSeriesMenu] = useState<EventSeriesMenuState | null>(null)
  const [seriesMenuError, setSeriesMenuError] = useState<string | null>(null)

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

  const filteredItems = useMemo(
    () =>
      filterCalendarItems(calendarItems, personnel, {
        searchQuery,
        kindFilter,
        personnelFilterId,
      }),
    [calendarItems, personnel, searchQuery, kindFilter, personnelFilterId],
  )

  const canEditCalendar = isSupabaseConfigured && canCreateAnyCalendarItem(can)

  const suppressEventClick = useCallback(() => {
    suppressEventClickUntilRef.current = Date.now() + 400
  }, [])

  const closeSeriesMenu = useCallback(() => {
    setSeriesMenu(null)
    setSeriesMenuError(null)
  }, [])

  const openSeriesMenu = useCallback((item: CalendarItem, x: number, y: number) => {
    setSeriesMenuError(null)
    setSeriesMenu({ item, x, y })
  }, [])

  const handleSeriesAction = useCallback(
    async (action: CalendarSeriesAction) => {
      if (!seriesMenu) return

      setSeriesMenuError(null)
      try {
        await seriesActions.mutateAsync({
          action,
          item: seriesMenu.item,
          viewContext: {
            activeView,
            visibleRange,
            calendarDate,
          },
          timezone: orgQuery.data?.timezone,
          allItems: calendarItems,
        })
        closeSeriesMenu()
      } catch (error) {
        setSeriesMenuError(error instanceof Error ? error.message : 'Could not update event series.')
      }
    },
    [seriesMenu, seriesActions, activeView, visibleRange, calendarDate, orgQuery.data?.timezone, calendarItems, closeSeriesMenu],
  )

  const canOpenSeriesMenu = useCallback(
    (item: CalendarItem) =>
      isSupabaseConfigured &&
      (canCreateKind(can, item.kind) || canDeleteKind(can, item.kind)),
    [can],
  )

  const events = useMemo(
    () =>
      filteredItems.map((item) => {
        const editable = isSupabaseConfigured && canEditCalendarItem(can, item.kind)
        const hasConflict = itemHasShiftConflict(calendarItems, item)

        return {
          id: item.id,
          title: getCalendarItemDisplayLabel(item, personnel),
          start: item.startsAt,
          end: item.endsAt,
          editable,
          startEditable: editable,
          durationEditable: editable,
          classNames: [
            eventClassNames[item.kind as CalendarItemKind],
            hasConflict ? 'event-conflict' : '',
          ].filter(Boolean),
          extendedProps: { item, hasConflict },
        }
      }),
    [filteredItems, calendarItems, can, personnel],
  )

  const getApi = () => calendarRef.current?.getApi()

  const handleDatesSet = (arg: {
    start: Date
    end: Date
    view: { type: string; title: string; calendar: { getDate: () => Date } }
  }) => {
    setActiveView(arg.view.type as CalendarViewId)
    setVisibleRange({ start: arg.start, end: arg.end })
    const anchor = arg.view.calendar.getDate()
    setCalendarDate(anchor)
    setViewTitle(arg.view.title)
    setWeekStartKey(getWeekStartKey(anchor))
  }

  const handleToggleNightShift = () => {
    if (!isSupabaseConfigured || !can('organization.update')) return
    nightShiftMutation.mutate({ weekKey: weekStartKey, enabled: !nightShiftEnabled })
  }

  const handleDateSelect = (selection: {
    start: Date
    end: Date | null
  }) => {
    if (!canEditCalendar) return
    getApi()?.unselect()

    const startsAt = selection.start.toISOString()
    const endsAt = selection.end
      ? selection.end.toISOString()
      : defaultEventEnd(startsAt)

    openCreateEvent(normalizeEventRange(startsAt, endsAt))
  }

  const handleEventClick = (arg: { event: { extendedProps: Record<string, unknown> } }) => {
    if (Date.now() < suppressEventClickUntilRef.current) return
    const item = arg.event.extendedProps.item as CalendarItem
    openEditEvent(item)
  }

  const handleEventDrop = async (arg: {
    event: { start: Date | null; end: Date | null; extendedProps: Record<string, unknown> }
    revert: () => void
  }) => {
    const item = arg.event.extendedProps.item as CalendarItem
    if (!item || !arg.event.start || !arg.event.end) {
      arg.revert()
      return
    }

    try {
      await updateTimes.mutateAsync({
        id: item.id,
        startsAt: arg.event.start.toISOString(),
        endsAt: arg.event.end.toISOString(),
      })
    } catch {
      arg.revert()
    }
  }

  const handleEventResize = async (arg: {
    event: { start: Date | null; end: Date | null; extendedProps: Record<string, unknown> }
    revert: () => void
  }) => {
    const item = arg.event.extendedProps.item as CalendarItem
    if (!item || !arg.event.start || !arg.event.end) {
      arg.revert()
      return
    }

    try {
      await updateTimes.mutateAsync({
        id: item.id,
        startsAt: arg.event.start.toISOString(),
        endsAt: arg.event.end.toISOString(),
      })
    } catch {
      arg.revert()
    }
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
        initialDate={calendarDate}
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
        selectMirror
        unselectAuto
        height="100%"
        events={events}
        dayMaxEvents={3}
        datesSet={handleDatesSet}
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventDidMount={(info) => {
          const item = info.event.extendedProps.item as CalendarItem | undefined
          if (!item) return

          const cleanup = attachEventSeriesMenuTriggers(
            info.el,
            item,
            canOpenSeriesMenu(item),
            ({ x, y }) => openSeriesMenu(item, x, y),
            suppressEventClick,
          )
          seriesMenuCleanupRef.current.set(info.event.id, cleanup)
        }}
        eventWillUnmount={(info) => {
          const cleanup = seriesMenuCleanupRef.current.get(info.event.id)
          cleanup?.()
          seriesMenuCleanupRef.current.delete(info.event.id)
        }}
        eventContent={(arg) => {
          // selectMirror placeholder events have no extendedProps — skip custom chip.
          if (arg.isMirror) return true

          const item = arg.event.extendedProps.item as CalendarItem | undefined
          if (!item) return true

          return (
            <EventChip
              allDay={arg.event.allDay}
              start={arg.event.start}
              end={arg.event.end}
              item={item}
              personnel={personnel}
              hasConflict={Boolean(arg.event.extendedProps.hasConflict)}
            />
          )
        }}
        windowResize={() => {
          calendarRef.current?.getApi().updateSize()
        }}
      />

      <EventSeriesMenu
        menu={seriesMenu}
        allItems={calendarItems}
        canCreate={seriesMenu ? canCreateKind(can, seriesMenu.item.kind) : false}
        canDelete={seriesMenu ? canDeleteKind(can, seriesMenu.item.kind) : false}
        isPending={seriesActions.isPending}
        errorMessage={seriesMenuError}
        onClose={closeSeriesMenu}
        onAction={handleSeriesAction}
      />
    </div>
  )
}
