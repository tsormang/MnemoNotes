import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { CalendarItem } from '../../types/domain'
import { getSeriesSiblings } from '../../lib/calendar-series'
import type { CalendarSeriesAction } from '../../lib/queries/mutations'

export interface EventSeriesMenuState {
  item: CalendarItem
  x: number
  y: number
}

interface EventSeriesMenuProps {
  menu: EventSeriesMenuState | null
  allItems: CalendarItem[]
  canCreate: boolean
  canDelete: boolean
  isPending: boolean
  errorMessage: string | null
  onClose: () => void
  onAction: (action: CalendarSeriesAction) => void
}

const menuItems: Array<{
  action: CalendarSeriesAction
  labelKey: 'duplicateNextDay' | 'duplicateWeek' | 'duplicateMonth' | 'deleteCurrent' | 'deleteSeriesExcept'
  requiresCreate?: boolean
  requiresDelete?: boolean
  requiresSeries?: boolean
  destructive?: boolean
}> = [
  { action: { type: 'duplicate', mode: 'next-day' }, labelKey: 'duplicateNextDay', requiresCreate: true },
  {
    action: { type: 'duplicate', mode: 'week' },
    labelKey: 'duplicateWeek',
    requiresCreate: true,
  },
  { action: { type: 'duplicate', mode: 'month' }, labelKey: 'duplicateMonth', requiresCreate: true },
  {
    action: { type: 'delete' },
    labelKey: 'deleteCurrent',
    requiresDelete: true,
    destructive: true,
  },
  {
    action: { type: 'delete-series-except' },
    labelKey: 'deleteSeriesExcept',
    requiresDelete: true,
    requiresSeries: true,
    destructive: true,
  },
]

export function EventSeriesMenu({
  menu,
  allItems,
  canCreate,
  canDelete,
  isPending,
  errorMessage,
  onClose,
  onAction,
}: EventSeriesMenuProps) {
  const { t } = useTranslation('calendar')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (menuRef.current?.contains(target)) return
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('touchstart', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onClose, true)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [menu, onClose])

  useEffect(() => {
    if (!menu || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    let left = menu.x
    let top = menu.y

    if (left + rect.width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - rect.width - padding)
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - rect.height - padding)
    }

    menuRef.current.style.left = `${left}px`
    menuRef.current.style.top = `${top}px`
  }, [menu, errorMessage])

  if (!menu) return null

  const seriesCount = getSeriesSiblings(allItems, menu.item).length

  return createPortal(
    <div
      ref={menuRef}
      className="event-series-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label="Event actions"
    >
      {menuItems.map((entry) => {
        const disabled =
          isPending ||
          (entry.requiresCreate && !canCreate) ||
          (entry.requiresDelete && !canDelete) ||
          (entry.requiresSeries && seriesCount <= 1)

        return (
          <button
            key={entry.labelKey}
            type="button"
            role="menuitem"
            className={`event-series-menu__item${entry.destructive ? ' event-series-menu__item--destructive' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              onAction(entry.action)
            }}
          >
            {t(`series.${entry.labelKey}`)}
          </button>
        )
      })}
      {errorMessage ? <p className="event-series-menu__error">{errorMessage}</p> : null}
    </div>,
    document.body,
  )
}

const LONG_PRESS_MS = 500

export function attachEventSeriesMenuTriggers(
  element: HTMLElement,
  _item: CalendarItem,
  canOpen: boolean,
  onOpen: (coords: { x: number; y: number }) => void,
  onSuppressClick: () => void,
) {
  if (!canOpen) {
    return () => {}
  }

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let longPressOpened = false

  const clearPressTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onOpen({ x: event.clientX, y: event.clientY })
  }

  const onTouchStart = (event: TouchEvent) => {
    longPressOpened = false
    clearPressTimer()
    const touch = event.touches[0]
    if (!touch) return

    pressTimer = setTimeout(() => {
      longPressOpened = true
      onSuppressClick()
      onOpen({ x: touch.clientX, y: touch.clientY })
    }, LONG_PRESS_MS)
  }

  const onTouchEnd = () => {
    clearPressTimer()
    if (longPressOpened) {
      onSuppressClick()
    }
  }

  const onTouchMove = () => {
    clearPressTimer()
  }

  element.addEventListener('contextmenu', onContextMenu)
  element.addEventListener('touchstart', onTouchStart, { passive: true })
  element.addEventListener('touchend', onTouchEnd)
  element.addEventListener('touchmove', onTouchMove, { passive: true })
  element.addEventListener('touchcancel', onTouchEnd)

  return () => {
    clearPressTimer()
    element.removeEventListener('contextmenu', onContextMenu)
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchend', onTouchEnd)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchcancel', onTouchEnd)
  }
}
