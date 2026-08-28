import { describe, expect, it } from 'vitest'
import { formatAuditAction, formatAuditEntityTable } from './audit-labels'

describe('formatAuditAction', () => {
  it('maps known actions', () => {
    expect(formatAuditAction('personnel.invited')).toBe('Personnel invited')
  })

  it('falls back for unknown actions', () => {
    expect(formatAuditAction('calendar.updated')).toBe('calendar · updated')
  })
})

describe('formatAuditEntityTable', () => {
  it('maps known tables', () => {
    expect(formatAuditEntityTable('personnel')).toBe('Personnel')
  })
})
