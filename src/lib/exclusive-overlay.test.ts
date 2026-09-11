import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  announceExclusiveOverlay,
  dismissFullCalendarPopovers,
  EXCLUSIVE_OVERLAY_EVENT,
  subscribeExclusiveOverlay,
  useExclusiveOverlay,
} from './exclusive-overlay'

describe('exclusive overlay', () => {
  it('notifies other subscribers when a new overlay opens', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = subscribeExclusiveOverlay('first', first)
    const stopSecond = subscribeExclusiveOverlay('second', second)

    announceExclusiveOverlay('second')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    stopFirst()
    stopSecond()
  })

  it('clicks FullCalendar popover close buttons', () => {
    const popover = document.createElement('div')
    popover.className = 'fc-more-popover fc-popover'
    const close = document.createElement('button')
    close.className = 'fc-popover-close'
    const onClick = vi.fn()
    close.addEventListener('click', onClick)
    popover.appendChild(close)
    document.body.appendChild(popover)

    dismissFullCalendarPopovers()

    expect(onClick).toHaveBeenCalledTimes(1)
    popover.remove()
  })

  it('displaces an active hook when another overlay is announced', () => {
    const onDisplace = vi.fn()
    const { unmount } = renderHook(() => useExclusiveOverlay(true, onDisplace))

    act(() => {
      window.dispatchEvent(new CustomEvent(EXCLUSIVE_OVERLAY_EVENT, { detail: { id: 'other' } }))
    })

    expect(onDisplace).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does not displace a busy overlay', () => {
    const onDisplace = vi.fn()
    const { unmount } = renderHook(() => useExclusiveOverlay(true, onDisplace, true))

    act(() => {
      window.dispatchEvent(new CustomEvent(EXCLUSIVE_OVERLAY_EVENT, { detail: { id: 'other' } }))
    })

    expect(onDisplace).not.toHaveBeenCalled()
    unmount()
  })
})
