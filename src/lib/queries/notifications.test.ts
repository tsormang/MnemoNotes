import { describe, expect, it } from 'vitest'
import {
  isActiveDueNotification,
  markAndFilterNewDueNotifications,
  shouldPopupNotification,
  type InAppNotification,
} from './notifications'

function makeNotification(
  id: string,
  overrides: Partial<InAppNotification> = {},
): InAppNotification {
  return {
    id,
    organizationId: 'org-1',
    calendarItemId: 'item-1',
    title: 'Test',
    kind: 'shift',
    requiresAcknowledgement: false,
    scheduledFor: '2026-08-28T08:00:00.000Z',
    status: 'delivered',
    triggerKind: 'at_start',
    offsetMinutes: 0,
    ...overrides,
  }
}

describe('notification lifecycle helpers', () => {
  it('only popups delivered jobs that are due', () => {
    expect(shouldPopupNotification(makeNotification('a'))).toBe(true)
    expect(shouldPopupNotification(makeNotification('b', { status: 'sent' }))).toBe(false)
    expect(
      shouldPopupNotification(
        makeNotification('c', { scheduledFor: '2099-01-01T08:00:00.000Z', status: 'queued' }),
      ),
    ).toBe(false)
  })

  it('drops stale reminders after the calendar item ends', () => {
    const notification = makeNotification('stale', { calendarItemId: 'shift-1' })
    const calendarItems = [
      {
        id: 'shift-1',
        kind: 'shift' as const,
        title: 'Morning',
        startsAt: '2026-08-28T06:00:00.000Z',
        endsAt: '2026-08-28T07:00:00.000Z',
        locationId: 'loc-1',
        assignedPersonnelIds: [],
        priority: 'normal' as const,
        notificationOffsets: [],
        requiresAcknowledgement: false,
      },
    ]

    expect(isActiveDueNotification(notification, calendarItems)).toBe(false)
  })
})

describe('markAndFilterNewDueNotifications', () => {
  it('returns only notifications that have not been shown yet', () => {
    const shownIds = new Set<string>()
    const due = [makeNotification('a'), makeNotification('b')]

    const firstPass = markAndFilterNewDueNotifications(due, shownIds)
    expect(firstPass.map((item) => item.id)).toEqual(['a', 'b'])

    const secondPass = markAndFilterNewDueNotifications(due, shownIds)
    expect(secondPass).toEqual([])
  })

  it('does not return the same job id twice across polls', () => {
    const shownIds = new Set<string>()
    const notification = makeNotification('job-42')

    expect(markAndFilterNewDueNotifications([notification], shownIds)).toHaveLength(1)
    expect(markAndFilterNewDueNotifications([notification], shownIds)).toHaveLength(0)
  })
})
