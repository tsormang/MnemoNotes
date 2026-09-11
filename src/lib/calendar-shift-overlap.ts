import { addDays, format, startOfDay } from 'date-fns'
import type { CalendarItem, Personnel } from '../types/domain'
import { clockToMinutes, formatClockLabel, isClockTime } from './calendar-hours'
import { isAllDayCalendarItem } from './calendar-datetime'

export const UNASSIGNED_LANE_ID = '__unassigned__'

export interface ShiftOverlapSegment {
  itemId: string
  personnelId: string | null
  /** Minutes from local midnight of the focused day. */
  startMinutes: number
  endMinutes: number
  leftPercent: number
  widthPercent: number
  labelStart: string
  labelEnd: string
}

export interface ShiftOverlapLane {
  personnelId: string | null
  segments: ShiftOverlapSegment[]
}

export interface ShiftOverlapHourTick {
  minutes: number
  label: string
  leftPercent: number
}

export interface ShiftOverlapDiagram {
  windowStartMinutes: number
  windowEndMinutes: number
  hourTicks: ShiftOverlapHourTick[]
  lanes: ShiftOverlapLane[]
}

function minutesFromDayStart(timestamp: number, dayStartMs: number): number {
  return (timestamp - dayStartMs) / 60_000
}

function minutesToClockLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)))
  if (clamped >= 24 * 60) return '24:00'
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function toPercent(value: number, windowStart: number, windowSpan: number): number {
  if (windowSpan <= 0) return 0
  return ((value - windowStart) / windowSpan) * 100
}

/** Clip a shift to the focused local day and visible clock window. */
export function clipShiftToDayWindow(
  startsAt: string,
  endsAt: string,
  day: Date,
  windowStartMinutes: number,
  windowEndMinutes: number,
): Array<{ startMinutes: number; endMinutes: number }> {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const dayStartMs = dayStart.getTime()
  const startMs = new Date(startsAt).getTime()
  const endMs = new Date(endsAt).getTime()

  const clipStartMs = Math.max(startMs, dayStartMs)
  const clipEndMs = Math.min(endMs, dayEnd.getTime())
  if (!(clipStartMs < clipEndMs)) return []

  let startMinutes = minutesFromDayStart(clipStartMs, dayStartMs)
  let endMinutes = minutesFromDayStart(clipEndMs, dayStartMs)

  startMinutes = Math.max(startMinutes, windowStartMinutes)
  endMinutes = Math.min(endMinutes, windowEndMinutes)
  if (!(startMinutes < endMinutes)) return []

  return [{ startMinutes, endMinutes }]
}

export function buildHourTicks(
  windowStartMinutes: number,
  windowEndMinutes: number,
): ShiftOverlapHourTick[] {
  const windowSpan = windowEndMinutes - windowStartMinutes
  if (windowSpan <= 0) return []

  const ticks: ShiftOverlapHourTick[] = []
  const firstHour = Math.ceil(windowStartMinutes / 60)
  const lastHour = Math.floor(windowEndMinutes / 60)

  if (windowStartMinutes % 60 !== 0) {
    ticks.push({
      minutes: windowStartMinutes,
      label: minutesToClockLabel(windowStartMinutes),
      leftPercent: 0,
    })
  }

  for (let hour = firstHour; hour <= lastHour; hour += 1) {
    const minutes = hour * 60
    if (minutes < windowStartMinutes || minutes > windowEndMinutes) continue
    ticks.push({
      minutes,
      label: formatClockLabel(
        hour === 24 ? '24:00' : `${String(hour).padStart(2, '0')}:00`,
      ),
      leftPercent: toPercent(minutes, windowStartMinutes, windowSpan),
    })
  }

  if (windowEndMinutes % 60 !== 0 && windowEndMinutes !== windowStartMinutes) {
    ticks.push({
      minutes: windowEndMinutes,
      label: minutesToClockLabel(windowEndMinutes),
      leftPercent: 100,
    })
  }

  return ticks
}

function resolveWindowMinutes(windowStart: string, windowEnd: string): {
  start: number
  end: number
} {
  const start = isClockTime(windowStart) ? clockToMinutes(windowStart) : 0
  const end = isClockTime(windowEnd) ? clockToMinutes(windowEnd) : 24 * 60
  return { start, end: Math.max(start + 1, end) }
}

function segmentGeometry(
  itemId: string,
  personnelId: string | null,
  startMinutes: number,
  endMinutes: number,
  windowStart: number,
  windowSpan: number,
): ShiftOverlapSegment {
  return {
    itemId,
    personnelId,
    startMinutes,
    endMinutes,
    leftPercent: toPercent(startMinutes, windowStart, windowSpan),
    widthPercent: ((endMinutes - startMinutes) / windowSpan) * 100,
    labelStart: minutesToClockLabel(startMinutes),
    labelEnd: minutesToClockLabel(endMinutes),
  }
}

/** Build a day Gantt of timed shifts: one lane per assignee (plus unassigned). */
export function buildShiftOverlapDiagram(
  items: CalendarItem[],
  day: Date,
  windowStart: string,
  windowEnd: string,
  personnel: Personnel[] = [],
): ShiftOverlapDiagram {
  const { start: windowStartMinutes, end: windowEndMinutes } = resolveWindowMinutes(
    windowStart,
    windowEnd,
  )
  const windowSpan = windowEndMinutes - windowStartMinutes
  const hourTicks = buildHourTicks(windowStartMinutes, windowEndMinutes)

  const laneMap = new Map<string, ShiftOverlapLane>()

  const ensureLane = (personnelId: string | null): ShiftOverlapLane => {
    const key = personnelId ?? UNASSIGNED_LANE_ID
    let lane = laneMap.get(key)
    if (!lane) {
      lane = { personnelId, segments: [] }
      laneMap.set(key, lane)
    }
    return lane
  }

  const dayShifts = items.filter((item) => item.kind === 'shift' && !isAllDayCalendarItem(item))

  for (const item of dayShifts) {
    const ranges = clipShiftToDayWindow(
      item.startsAt,
      item.endsAt,
      day,
      windowStartMinutes,
      windowEndMinutes,
    )
    if (ranges.length === 0) continue

    const assigneeIds =
      item.assignedPersonnelIds.length > 0 ? item.assignedPersonnelIds : [null]

    for (const personnelId of assigneeIds) {
      const lane = ensureLane(personnelId)
      for (const range of ranges) {
        lane.segments.push(
          segmentGeometry(
            item.id,
            personnelId,
            range.startMinutes,
            range.endMinutes,
            windowStartMinutes,
            windowSpan,
          ),
        )
      }
    }
  }

  const rosterOrder = new Map(personnel.map((person, index) => [person.id, index]))
  const lanes = Array.from(laneMap.values()).sort((left, right) => {
    if (left.personnelId == null) return 1
    if (right.personnelId == null) return -1
    const leftIndex = rosterOrder.get(left.personnelId) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = rosterOrder.get(right.personnelId) ?? Number.MAX_SAFE_INTEGER
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.personnelId.localeCompare(right.personnelId)
  })

  for (const lane of lanes) {
    lane.segments.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
  }

  return {
    windowStartMinutes,
    windowEndMinutes,
    hourTicks,
    lanes,
  }
}

export function formatShiftOverlapDayLabel(day: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(day)
}

/** Stable date key for the focused local calendar day. */
export function shiftOverlapDayKey(day: Date): string {
  return format(startOfDay(day), 'yyyy-MM-dd')
}
