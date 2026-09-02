import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import clsx from 'clsx'
import { addDays, format, startOfDay, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Copy, MoonStar, Plus, Printer } from 'lucide-react'
import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  applyCalendarBubbleColors,
  buildPersonnelBubbleColorMap,
  getCalendarBubbleColors,
} from '../../lib/calendar-bubble-colors'
import { formatShiftStaffLabel, getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { itemHasShiftConflict } from '../../lib/calendar-conflicts'
import { defaultEventEnd, isCalendarItemPassed, normalizeEventRange } from '../../lib/calendar-datetime'
import { IconAvatar } from '../../components/icons/IconAvatar'
import { defaultIconIdForKind } from '../../lib/icons/defaults'
import { useMediaQuery } from '../../lib/use-media-query'
import {
  canCreateAnyCalendarItem,
  canCreateKind,
  canDeleteKind,
  canEditCalendarItem,
} from '../../lib/calendar-permissions'
import {
  useCalendarScheduleActions,
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
import i18n from '../../i18n'
import { localeToFullCalendar } from '../../i18n/types'
import { useLocaleStore } from '../../store/locale'
import type { CalendarItem, CalendarItemKind, Personnel } from '../../types/domain'
import { useDisplayPreferences } from '../../store/display-preferences'
import { filterCalendarItems, useCalendarShell } from './CalendarShellContext'
import {
  analyzeCopyConflicts,
  canReplaceCopyConflicts,
  type CopyConflictAnalysis,
} from '../../lib/calendar-copy-overwrite'
import { buildDuplicateTargets } from '../../lib/calendar-series'
import { buildScheduleCopyTargets, type ScheduleAction } from '../../lib/calendar-schedule-copy'
import { CalendarPrintPreview } from './CalendarPrintPreview'
import { CopyOverwriteConfirmModal } from './CopyOverwriteConfirmModal'
import {
  CalendarScheduleCopyModal,
  type ScheduleCopyScope,
} from './CalendarScheduleCopyModal'
import {
  attachEventSeriesMenuTriggers,
  EventSeriesMenu,
  type EventSeriesMenuState,
} from './EventSeriesMenu'
import { MobileCalendarAgenda } from './MobileCalendarAgenda'

const MOBILE_CALENDAR_QUERY = '(max-width: 720px)'

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
  { id: 'timeGridDay', labelKey: 'view.day' },
  { id: 'timeGridWeek', labelKey: 'view.week' },
  { id: 'dayGridMonth', labelKey: 'view.month' },
] as const

type CalendarViewId = (typeof calendarViews)[number]['id']

type PendingCopyOverwrite =
  | {
      kind: 'schedule'
      action: ScheduleAction
      analysis: CopyConflictAnalysis
    }
  | {
      kind: 'series'
      action: CalendarSeriesAction
      analysis: CopyConflictAnalysis
    }

interface CopyExecutionOptions {
  overwriteItemIds?: string[]
  skipConflictedTargetKeys?: string[]
}

const desktopPrintPreviewQuery = '(min-width: 721px)'

function getInitialView(): CalendarViewId {
  if (typeof window !== 'undefined' && window.matchMedia(MOBILE_CALENDAR_QUERY).matches) {
    return 'timeGridDay'
  }
  return 'timeGridWeek'
}

function supportsPrintPreview(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(desktopPrintPreviewQuery).matches
}

function isPassedShiftOrNote(item: CalendarItem): boolean {
  return (item.kind === 'shift' || item.kind === 'note') && isCalendarItemPassed(item)
}

function EventChip({
  allDay,
  start,
  end,
  item,
  personnel,
  hasConflict,
  compact,
  isPassed,
}: {
  allDay: boolean
  start: Date | null
  end: Date | null
  item: CalendarItem
  personnel: Personnel[]
  hasConflict: boolean
  compact?: boolean
  isPassed?: boolean
}) {
  const avatarSize = compact ? 'sm' : 'md'
  const assignees = personnel.filter((person) => item.assignedPersonnelIds.includes(person.id))
  const headline =
    item.kind === 'shift'
      ? formatShiftStaffLabel(assignees)
      : item.title.trim() || i18n.t('calendar:event.untitled')
  const timeLabel =
    allDay || !start
      ? null
      : `${format(start, 'HH:mm')}${end ? ` – ${format(end, 'HH:mm')}` : ''}`

  return (
    <div
      className={clsx(
        'fc-event-chip',
        hasConflict && 'fc-event-chip--conflict',
        isPassed && 'fc-event-chip--passed',
      )}
    >
      {item.kind === 'shift' && assignees[0] ? (
        <IconAvatar
          iconId={assignees[0].iconId}
          entityType="personnel"
          label={assignees[0].fullName}
          size={avatarSize}
          className="fc-event-avatar"
        />
      ) : item.kind !== 'shift' ? (
        <IconAvatar
          iconId={item.iconId ?? defaultIconIdForKind(item.kind)}
          entityType={item.kind}
          size={avatarSize}
          className="fc-event-avatar"
          initialsFallback={false}
        />
      ) : null}
      <div className="fc-event-text">
        <strong>{headline}</strong>
        {timeLabel ? <span>{timeLabel}</span> : null}
      </div>
    </div>
  )
}

function WeekDayHeader({
  label,
  date,
  showAdd,
  addLabel,
  onAdd,
}: {
  label: string
  date: Date
  showAdd?: boolean
  addLabel?: string
  onAdd?: (date: Date) => void
}) {
  return (
    <div className="fc-day-header">
      <span className="fc-day-header__label">{label}</span>
      {showAdd && onAdd ? (
        <button
          type="button"
          className="calendar-day-add-btn"
          aria-label={addLabel}
          title={addLabel}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onAdd(date)
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}
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
  onCopy,
  onPrint,
  showViewSwitch = true,
  showCopy = true,
  showPrint = true,
  showNightShift = true,
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
  onCopy: () => void
  onPrint: () => void
  showViewSwitch?: boolean
  showCopy?: boolean
  showPrint?: boolean
  showNightShift?: boolean
}) {
  const { t } = useTranslation(['calendar', 'common'])
  const nightShiftLabel = nightShiftEnabled
    ? t('calendar:nightShift.on', { range: nightShiftHint })
    : t('calendar:nightShift.off', { range: nightShiftHint })

  return (
    <div className="calendar-utility-ribbon" role="toolbar" aria-label={t('calendar:aria.utilityRibbon')}>
      <div className="calendar-utility-ribbon__nav">
        <button type="button" className="calendar-ribbon-btn" aria-label={t('common:actions.previous')} onClick={onPrev}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="calendar-ribbon-btn" aria-label={t('common:actions.next')} onClick={onNext}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="calendar-ribbon-btn calendar-ribbon-btn--label" onClick={onToday}>
          {t('common:actions.today')}
        </button>
      </div>

      <h2 className="calendar-utility-ribbon__title">{title}</h2>

      <div className="calendar-utility-ribbon__tools">
        {showCopy ? (
          <button
            type="button"
            className="calendar-ribbon-btn"
            aria-label={t('calendar:aria.copySchedule')}
            title={t('calendar:aria.copySchedule')}
            onClick={onCopy}
          >
            <Copy size={18} aria-hidden="true" />
          </button>
        ) : null}

        {showPrint ? (
          <button
            type="button"
            className="calendar-ribbon-btn"
            aria-label={t('calendar:aria.print')}
            title={t('calendar:aria.print')}
            onClick={onPrint}
          >
            <Printer size={18} aria-hidden="true" />
          </button>
        ) : null}

        {showNightShift ? (
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
        ) : null}

        {showViewSwitch ? (
          <div className="calendar-view-switch" role="group" aria-label={t('calendar:aria.viewSwitch')}>
            {calendarViews.map((view) => (
              <button
                key={view.id}
                type="button"
                className={clsx('calendar-ribbon-btn', activeView === view.id && 'is-active')}
                aria-pressed={activeView === view.id}
                onClick={() => onChangeView(view.id)}
              >
                {t(`calendar:${view.labelKey}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PharmacyCalendar() {
  const { t } = useTranslation('calendar')
  const locale = useLocaleStore((state) => state.locale)
  const calendarLocale = localeToFullCalendar(locale)
  const { user } = useAuth()
  const { organizationId, can } = useWorkspace()
  const { searchQuery, kindFilter, personnelFilterId, openCreateEvent, openEditEvent } =
    useCalendarShell()
  const showTasks = useDisplayPreferences((state) => state.showTasks)
  const orgQuery = useOrganization(organizationId)
  const calendarQuery = useCalendarItems(organizationId)
  const personnelQuery = usePersonnelList(organizationId)
  const weekOverridesQuery = useWeekOverrides(organizationId)
  const updateTimes = useUpdateCalendarItemTimes(organizationId)
  const seriesActions = useCalendarSeriesActions(organizationId, user?.id ?? null)
  const scheduleActions = useCalendarScheduleActions(organizationId, user?.id ?? null)
  const queryClient = useQueryClient()

  const calendarRef = useRef<FullCalendar>(null)
  const calendarPrintRef = useRef<HTMLDivElement>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [scheduleCopyOpen, setScheduleCopyOpen] = useState(false)
  const [scheduleCopyError, setScheduleCopyError] = useState<string | null>(null)
  const [pendingCopyOverwrite, setPendingCopyOverwrite] = useState<PendingCopyOverwrite | null>(null)
  const [printLayoutActive, setPrintLayoutActive] = useState(false)
  const [printLayoutReady, setPrintLayoutReady] = useState(false)
  const showPrintLayout = printPreviewOpen || printLayoutActive
  const suppressEventClickUntilRef = useRef(0)
  const prevMobileAgendaRef = useRef(false)
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
  const isMobileCalendar = useMediaQuery(MOBILE_CALENDAR_QUERY)
  const showMobileDayAgenda =
    isMobileCalendar && activeView === 'timeGridDay' && !showPrintLayout
  const showMobileWeekAgenda =
    isMobileCalendar && activeView === 'timeGridWeek' && !showPrintLayout
  const showMobileListView = showMobileDayAgenda || showMobileWeekAgenda
  const [agendaDate, setAgendaDate] = useState(() => new Date())
  const [seriesMenu, setSeriesMenu] = useState<EventSeriesMenuState | null>(null)
  const [seriesMenuError, setSeriesMenuError] = useState<string | null>(null)
  const [passedTick, setPassedTick] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => setPassedTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (showMobileListView && !prevMobileAgendaRef.current) {
      setAgendaDate(calendarDate)
    }
    prevMobileAgendaRef.current = showMobileListView
  }, [showMobileListView, calendarDate])

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
        showTasks,
      }),
    [calendarItems, personnel, searchQuery, kindFilter, personnelFilterId, showTasks],
  )

  const canEditCalendar = isSupabaseConfigured && canCreateAnyCalendarItem(can)

  useEffect(() => {
    if (!showPrintLayout) {
      setPrintLayoutReady(false)
      calendarRef.current?.getApi().updateSize()
      return
    }

    let cancelled = false
    const frame = requestAnimationFrame(() => {
      calendarRef.current?.getApi().updateSize()
      requestAnimationFrame(() => {
        if (!cancelled) setPrintLayoutReady(true)
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [showPrintLayout, viewTitle, activeView, slotMinTime, slotMaxTime, filteredItems.length])

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintLayoutActive(false)
      setPrintPreviewOpen(false)
    }

    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  useEffect(() => {
    if (!printLayoutActive || printPreviewOpen || !printLayoutReady) return

    window.print()
  }, [printLayoutActive, printPreviewOpen, printLayoutReady])

  const handlePrint = useCallback(() => {
    if (supportsPrintPreview()) {
      setPrintPreviewOpen(true)
      return
    }

    setPrintLayoutActive(true)
  }, [])

  const closePrintPreview = useCallback(() => {
    setPrintPreviewOpen(false)
  }, [])

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

  const mobileVisibleRange = useMemo(() => {
    const start = startOfWeek(agendaDate, { weekStartsOn: 1 })
    return { start, end: addDays(start, 7) }
  }, [agendaDate])

  const closeScheduleCopyModal = useCallback(() => {
    setScheduleCopyOpen(false)
    setScheduleCopyError(null)
  }, [])

  const scheduleCopyScope = useMemo((): ScheduleCopyScope => {
    if (showMobileWeekAgenda || activeView === 'timeGridWeek') return 'week'
    if (showMobileDayAgenda || activeView === 'timeGridDay') return 'day'
    return 'month'
  }, [showMobileWeekAgenda, showMobileDayAgenda, activeView])

  const scheduleViewContext = useMemo(
    () =>
      showMobileListView
        ? {
            activeView: (showMobileWeekAgenda ? 'timeGridWeek' : 'timeGridDay') as
              | 'timeGridWeek'
              | 'timeGridDay',
            visibleRange: showMobileWeekAgenda
              ? mobileVisibleRange
              : {
                  start: startOfDay(agendaDate),
                  end: addDays(startOfDay(agendaDate), 1),
                },
            calendarDate: agendaDate,
          }
        : {
            activeView,
            visibleRange,
            calendarDate,
          },
    [
      showMobileListView,
      showMobileWeekAgenda,
      mobileVisibleRange,
      agendaDate,
      activeView,
      visibleRange,
      calendarDate,
    ],
  )

  const canDeleteCalendarItem = useCallback(
    (item: CalendarItem) => isSupabaseConfigured && canDeleteKind(can, item.kind),
    [can],
  )

  const canCreateCalendarItem = useCallback(
    (item: CalendarItem) => isSupabaseConfigured && canCreateKind(can, item.kind),
    [can],
  )

  const executeScheduleAction = useCallback(
    async (action: ScheduleAction, options: CopyExecutionOptions = {}) => {
      setScheduleCopyError(null)
      await scheduleActions.mutateAsync({
        action,
        viewContext: scheduleViewContext,
        timezone: orgQuery.data?.timezone,
        allItems: calendarItems,
        canCreateItem: canCreateCalendarItem,
        canDeleteItem: canDeleteCalendarItem,
        overwriteItemIds: options.overwriteItemIds,
        skipConflictedTargetKeys: options.skipConflictedTargetKeys,
      })
      closeScheduleCopyModal()
      setPendingCopyOverwrite(null)
    },
    [
      scheduleActions,
      scheduleViewContext,
      orgQuery.data?.timezone,
      calendarItems,
      canCreateCalendarItem,
      canDeleteCalendarItem,
      closeScheduleCopyModal,
    ],
  )

  const handleScheduleAction = useCallback(
    async (action: ScheduleAction) => {
      if (action.type === 'clear') {
        const confirmKey =
          action.scope === 'day'
            ? 'scheduleCopy.clearConfirmDay'
            : action.scope === 'week'
              ? 'scheduleCopy.clearConfirmWeek'
              : 'scheduleCopy.clearConfirmMonth'
        if (!window.confirm(t(confirmKey))) return

        try {
          await executeScheduleAction(action)
        } catch (error) {
          setScheduleCopyError(
            error instanceof Error ? error.message : t('scheduleCopy.error'),
          )
        }
        return
      }

      const eligibleItems = calendarItems.filter(canCreateCalendarItem)
      const targets = buildScheduleCopyTargets(eligibleItems, action.copy, scheduleViewContext)
      if (targets.length === 0) {
        setScheduleCopyError(t('scheduleCopy.error'))
        return
      }

      const analysis = analyzeCopyConflicts(targets, calendarItems, canDeleteCalendarItem)
      if (analysis.hasConflicts) {
        if (!canReplaceCopyConflicts(analysis) && analysis.clearTargetCount === 0) {
          setScheduleCopyError(t('copyOverwrite.noPermission'))
          return
        }
        setPendingCopyOverwrite({ kind: 'schedule', action, analysis })
        return
      }

      try {
        await executeScheduleAction(action)
      } catch (error) {
        setScheduleCopyError(
          error instanceof Error ? error.message : t('scheduleCopy.error'),
        )
      }
    },
    [
      calendarItems,
      canCreateCalendarItem,
      canDeleteCalendarItem,
      scheduleViewContext,
      executeScheduleAction,
      t,
    ],
  )

  const mobileWeekStart = startOfWeek(agendaDate, { weekStartsOn: 1 })
  const mobileWeekEnd = addDays(mobileWeekStart, 6)

  const ribbonTitle = showMobileDayAgenda
    ? format(agendaDate, 'MMMM yyyy')
    : showMobileWeekAgenda
      ? `${format(mobileWeekStart, 'd MMM')} – ${format(mobileWeekEnd, 'd MMM yyyy')}`
      : viewTitle

  useEffect(() => {
    if (showMobileListView) {
      setWeekStartKey(getWeekStartKey(agendaDate))
      setCalendarDate(agendaDate)
    }
  }, [showMobileListView, agendaDate])

  const shiftAgendaWeek = useCallback((delta: number) => {
    setAgendaDate((current) => addDays(current, delta * 7))
  }, [])

  const handleChangeView = useCallback(
    (view: CalendarViewId) => {
      setActiveView(view)
      if ((view === 'timeGridDay' || view === 'timeGridWeek') && isMobileCalendar) {
        setAgendaDate(calendarDate)
        return
      }
      requestAnimationFrame(() => {
        calendarRef.current?.getApi()?.changeView(view)
      })
    },
    [isMobileCalendar, calendarDate],
  )

  useEffect(() => {
    if (showMobileListView || !isMobileCalendar) return
    requestAnimationFrame(() => {
      calendarRef.current?.getApi().updateSize()
    })
  }, [showMobileListView, isMobileCalendar, activeView])

  const handleCreateForDay = useCallback(
    (day: Date) => {
      const [hours = 7, minutes = 0] = workingDayStart.split(':').map(Number)
      const startsAt = new Date(day)
      startsAt.setHours(hours, minutes, 0, 0)
      const startsAtIso = startsAt.toISOString()
      openCreateEvent(normalizeEventRange(startsAtIso, defaultEventEnd(startsAtIso)))
    },
    [openCreateEvent, workingDayStart],
  )

  const createEventTargetDate = showMobileListView ? agendaDate : calendarDate
  const createEventLabel = t('aria.addEventForDay', {
    day: format(createEventTargetDate, 'EEEE d MMM'),
  })
  const showAddFab =
    canEditCalendar && !showPrintLayout && activeView === 'timeGridDay'

  const executeSeriesAction = useCallback(
    async (action: CalendarSeriesAction, options: CopyExecutionOptions = {}) => {
      if (!seriesMenu) return

      setSeriesMenuError(null)
      await seriesActions.mutateAsync({
        action,
        item: seriesMenu.item,
        viewContext: scheduleViewContext,
        timezone: orgQuery.data?.timezone,
        allItems: calendarItems,
        overwriteItemIds: options.overwriteItemIds,
        skipConflictedTargetKeys: options.skipConflictedTargetKeys,
      })
      closeSeriesMenu()
      setPendingCopyOverwrite(null)
    },
    [
      seriesMenu,
      seriesActions,
      scheduleViewContext,
      orgQuery.data?.timezone,
      calendarItems,
      closeSeriesMenu,
    ],
  )

  const handleSeriesAction = useCallback(
    async (action: CalendarSeriesAction) => {
      if (!seriesMenu) return

      if (action.type === 'duplicate') {
        const targets = buildDuplicateTargets(seriesMenu.item, action.mode, scheduleViewContext)
        if (targets.length === 0) {
          setSeriesMenuError(t('series.error'))
          return
        }

        const copyTargets = targets.map((target) => ({
          ...target,
          sourceItem: seriesMenu.item,
        }))
        const analysis = analyzeCopyConflicts(
          copyTargets,
          calendarItems,
          canDeleteCalendarItem,
          [seriesMenu.item.id],
        )
        if (analysis.hasConflicts) {
          if (!canReplaceCopyConflicts(analysis) && analysis.clearTargetCount === 0) {
            setSeriesMenuError(t('copyOverwrite.noPermission'))
            return
          }
          setPendingCopyOverwrite({ kind: 'series', action, analysis })
          return
        }
      }

      try {
        await executeSeriesAction(action)
      } catch (error) {
        setSeriesMenuError(error instanceof Error ? error.message : t('series.error'))
      }
    },
    [
      seriesMenu,
      scheduleViewContext,
      calendarItems,
      canDeleteCalendarItem,
      executeSeriesAction,
      t,
    ],
  )

  const runPendingCopyAction = useCallback(
    async (mode: 'replace' | 'ignore') => {
      if (!pendingCopyOverwrite) return

      const { analysis } = pendingCopyOverwrite
      const options: CopyExecutionOptions =
        mode === 'replace'
          ? { overwriteItemIds: analysis.replaceableItemIds }
          : { skipConflictedTargetKeys: analysis.conflictedTargetKeys }

      try {
        if (pendingCopyOverwrite.kind === 'schedule') {
          await executeScheduleAction(pendingCopyOverwrite.action, options)
          return
        }

        await executeSeriesAction(pendingCopyOverwrite.action, options)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message === 'No copies to create after skipping overlapping events.'
              ? t('copyOverwrite.nothingAfterIgnore')
              : error.message
            : pendingCopyOverwrite.kind === 'schedule'
              ? t('scheduleCopy.error')
              : t('series.error')
        if (pendingCopyOverwrite.kind === 'schedule') {
          setScheduleCopyError(message)
        } else {
          setSeriesMenuError(message)
        }
        setPendingCopyOverwrite(null)
      }
    },
    [pendingCopyOverwrite, executeScheduleAction, executeSeriesAction, t],
  )

  const canOpenSeriesMenu = useCallback(
    (item: CalendarItem) =>
      isSupabaseConfigured &&
      (canCreateKind(can, item.kind) || canDeleteKind(can, item.kind)),
    [can],
  )

  const personnelBubbleColors = useMemo(
    () => buildPersonnelBubbleColorMap(personnel),
    [personnel],
  )

  const events = useMemo(
    () =>
      filteredItems.map((item) => {
        const editable = isSupabaseConfigured && canEditCalendarItem(can, item.kind)
        const hasConflict = itemHasShiftConflict(calendarItems, item)
        const isPassed = isPassedShiftOrNote(item)

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
            isPassed ? 'event-passed' : '',
          ].filter(Boolean),
          extendedProps: { item, hasConflict, isPassed },
        }
      }),
    [filteredItems, calendarItems, can, personnel, passedTick],
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
    <div
      className={clsx(
        'calendar-fill calendar-print-root',
        showPrintLayout && 'calendar-print-layout',
        isMobileCalendar && !showPrintLayout && 'calendar-fill--mobile',
        showMobileListView && 'calendar-fill--mobile-agenda',
        showAddFab && 'calendar-fill--has-add-fab',
      )}
      aria-label={t('aria.main')}
    >
      <CalendarUtilityRibbon
        title={ribbonTitle}
        activeView={activeView}
        nightShiftEnabled={nightShiftEnabled}
        nightShiftHint={nightShiftHint}
        onPrev={showMobileListView ? () => shiftAgendaWeek(-1) : () => getApi()?.prev()}
        onNext={showMobileListView ? () => shiftAgendaWeek(1) : () => getApi()?.next()}
        onToday={showMobileListView ? () => setAgendaDate(new Date()) : () => getApi()?.today()}
        onChangeView={handleChangeView}
        onToggleNightShift={handleToggleNightShift}
        onCopy={() => setScheduleCopyOpen(true)}
        onPrint={handlePrint}
        showCopy={canEditCalendar && !showPrintLayout}
        showPrint={!isMobileCalendar}
        showNightShift={!isMobileCalendar}
      />

      {showMobileListView ? (
        <MobileCalendarAgenda
          mode={showMobileWeekAgenda ? 'week' : 'day'}
          items={filteredItems}
          allItems={calendarItems}
          personnel={personnel}
          selectedDate={agendaDate}
          onSelectDate={setAgendaDate}
          onOpenItem={(item) => {
            if (Date.now() < suppressEventClickUntilRef.current) return
            openEditEvent(item)
          }}
          onOpenSeriesMenu={openSeriesMenu}
          onSuppressItemClick={suppressEventClick}
          canOpenSeriesMenu={canOpenSeriesMenu}
          canCreate={canEditCalendar}
          onCreateForDay={handleCreateForDay}
        />
      ) : (
        <div ref={calendarPrintRef} className="calendar-print-body">
          <FullCalendar
            key={`${slotMinTime}-${slotMaxTime}`}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={activeView}
            initialDate={calendarDate}
            headerToolbar={false}
            locale={calendarLocale}
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
            height={showPrintLayout ? 'auto' : '100%'}
            events={events}
            dayMaxEvents={3}
            datesSet={handleDatesSet}
            dayHeaderContent={(arg) => {
              const showAdd =
                canEditCalendar &&
                !showPrintLayout &&
                arg.view.type === 'timeGridWeek'

              return (
                <WeekDayHeader
                  label={arg.text}
                  date={arg.date}
                  showAdd={showAdd}
                  addLabel={t('aria.addEventForDay', { day: format(arg.date, 'EEEE d MMM') })}
                  onAdd={handleCreateForDay}
                />
              )
            }}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventDidMount={(info) => {
              const item = info.event.extendedProps.item as CalendarItem | undefined
              if (!item) return

              const isPassed = Boolean(info.event.extendedProps.isPassed)
              applyCalendarBubbleColors(
                info.el,
                getCalendarBubbleColors(item, personnelBubbleColors, { passed: isPassed }),
              )

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
                  compact={isMobileCalendar}
                  isPassed={Boolean(arg.event.extendedProps.isPassed)}
                />
              )
            }}
            windowResize={() => {
              calendarRef.current?.getApi().updateSize()
            }}
          />
        </div>
      )}

      <CalendarPrintPreview
        open={printPreviewOpen}
        onClose={closePrintPreview}
        title={viewTitle}
        sourceRef={calendarPrintRef}
        layoutReady={printLayoutReady}
      />

      <CalendarScheduleCopyModal
        open={scheduleCopyOpen}
        scope={scheduleCopyScope}
        isPending={scheduleActions.isPending}
        errorMessage={scheduleCopyError}
        onClose={closeScheduleCopyModal}
        onAction={handleScheduleAction}
      />

      <CopyOverwriteConfirmModal
        open={pendingCopyOverwrite !== null}
        analysis={
          pendingCopyOverwrite?.analysis ?? {
            clearTargetCount: 0,
            conflictTargetCount: 0,
            conflictingItemIds: [],
            replaceableItemIds: [],
            noteConflicts: 0,
            shiftConflicts: 0,
            hasConflicts: false,
            conflictedTargetKeys: [],
          }
        }
        canReplace={
          pendingCopyOverwrite ? canReplaceCopyConflicts(pendingCopyOverwrite.analysis) : false
        }
        isPending={scheduleActions.isPending || seriesActions.isPending}
        onCancel={() => setPendingCopyOverwrite(null)}
        onIgnore={() => runPendingCopyAction('ignore')}
        onReplace={() => runPendingCopyAction('replace')}
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

      {showAddFab ? (
        <button
          type="button"
          className="calendar-add-fab"
          aria-label={createEventLabel}
          title={createEventLabel}
          onClick={() => handleCreateForDay(createEventTargetDate)}
        >
          <Plus size={24} aria-hidden="true" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  )
}
