import { useEffect, useId, useRef } from 'react'

export const EXCLUSIVE_OVERLAY_EVENT = 'mnemo:exclusive-overlay'

const FC_POPOVER_CLOSE_SELECTORS = [
  '.fc-popover .fc-popover-close',
  '.fc-more-popover .fc-popover-close',
].join(', ')

/** Dismiss FullCalendar more-event popovers so they cannot stack over app dialogs. */
export function dismissFullCalendarPopovers() {
  if (typeof document === 'undefined') return

  document.querySelectorAll<HTMLElement>(FC_POPOVER_CLOSE_SELECTORS).forEach((button) => {
    button.click()
  })
}

/** Announce that a root overlay opened so every other exclusive overlay can close. */
export function announceExclusiveOverlay(id: string) {
  dismissFullCalendarPopovers()
  window.dispatchEvent(new CustomEvent(EXCLUSIVE_OVERLAY_EVENT, { detail: { id } }))
}

export function subscribeExclusiveOverlay(id: string, onDisplace: () => void): () => void {
  const handler = (event: Event) => {
    const otherId = (event as CustomEvent<{ id?: string }>).detail?.id
    if (otherId && otherId !== id) onDisplace()
  }

  window.addEventListener(EXCLUSIVE_OVERLAY_EVENT, handler)
  return () => window.removeEventListener(EXCLUSIVE_OVERLAY_EVENT, handler)
}

/**
 * While `active`, this overlay is the only root popup. Opening another exclusive
 * overlay (modal, series menu, …) calls `onDisplace` unless `busy` is true.
 */
export function useExclusiveOverlay(active: boolean, onDisplace: () => void, busy = false) {
  const id = useId()
  const onDisplaceRef = useRef(onDisplace)

  useEffect(() => {
    onDisplaceRef.current = onDisplace
  }, [onDisplace])

  useEffect(() => {
    if (!active) return

    const stop = subscribeExclusiveOverlay(id, () => {
      if (!busy) onDisplaceRef.current()
    })
    announceExclusiveOverlay(id)
    return stop
  }, [active, busy, id])
}
