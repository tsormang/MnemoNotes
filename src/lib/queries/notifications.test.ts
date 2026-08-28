import { describe, expect, it } from 'vitest'
import {
  markAndFilterNewDueNotifications,
  type InAppNotification,
} from './notifications'

function makeNotification(id: string): InAppNotification {
  return {
    id,
    organizationId: 'org-1',
    calendarItemId: 'item-1',
    title: 'Test',
    kind: 'shift',
    requiresAcknowledgement: false,
    scheduledFor: '2026-08-28T08:00:00.000Z',
    status: 'queued',
    triggerKind: 'at_start',
  }
}

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
