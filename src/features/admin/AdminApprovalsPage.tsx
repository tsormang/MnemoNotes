import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Mail, Pencil, ShieldAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { FieldLabel } from '../../components/FieldLabel'
import { Modal } from '../../components/Modal'
import { formatDateTime24 } from '../../lib/calendar-datetime'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import {
  useRegistrationRequestsAdminList,
  type AdminRegistrationRequest,
} from '../../lib/queries/workspace'
import { createReviewRegistrationSchema, type ReviewRegistrationInput } from '../../lib/validation'
import { AdminShell } from './AdminShell'

type ReviewAction = 'approve' | 'reject' | 'update' | 'resend'

export function AdminApprovalsPage() {
  const { t: tv } = useTranslation('validation')
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const requestsQuery = useRegistrationRequestsAdminList(statusFilter)
  const [selected, setSelected] = useState<AdminRegistrationRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<ReviewAction | null>(null)

  const reviewSchema = useMemo(() => createReviewRegistrationSchema(tv), [tv])
  const form = useForm<ReviewRegistrationInput>({
    resolver: zodResolver(reviewSchema),
    values: selected
      ? {
          companyName: selected.companyName,
          fullName: selected.fullName,
          timezone: selected.timezone,
          reviewNote: selected.reviewNote ?? '',
        }
      : {
          companyName: '',
          fullName: '',
          timezone: 'Europe/Athens',
          reviewNote: '',
        },
  })

  const requests = requestsQuery.data ?? []

  function closeEditor() {
    setSelected(null)
    setError(null)
  }

  async function invalidateLists() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-registration-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-registration-requests-pending-count'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] }),
    ])
  }

  async function runAction(action: ReviewAction) {
    if (!selected) return
    setError(null)
    setNotice(null)
    setActionLink(null)

    const valid = await form.trigger()
    if (!valid && action !== 'reject' && action !== 'resend') {
      return
    }

    setBusyAction(action)

    const values = form.getValues()

    try {
      const result = await invokeEdgeFunction<{
        ok: boolean
        actionLink?: string | null
        emailSent?: boolean
        organizationName?: string
      }>('admin-review-registration', {
        action,
        requestId: selected.id,
        companyName: values.companyName,
        fullName: values.fullName,
        timezone: values.timezone,
        reviewNote: values.reviewNote?.trim() || undefined,
      })

      await invalidateLists()

      if (action === 'approve') {
        setNotice(
          result.emailSent
            ? `Approved ${result.organizationName ?? values.companyName}. A sign-in email was sent to the owner.`
            : `Approved ${result.organizationName ?? values.companyName}. Share the sign-in link if the owner needs it.`,
        )
        setActionLink(result.actionLink ?? null)
        closeEditor()
      } else if (action === 'reject') {
        setNotice(`Rejected ${values.companyName}. The owner account was removed.`)
        closeEditor()
      } else if (action === 'resend') {
        setNotice(result.emailSent ? 'Sign-in email sent again.' : 'Generated a fresh sign-in link.')
        setActionLink(result.actionLink ?? null)
      } else {
        setNotice('Request details saved.')
        setSelected({
          ...selected,
          companyName: values.companyName,
          fullName: values.fullName,
          timezone: values.timezone,
          reviewNote: values.reviewNote?.trim() || null,
        })
      }
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update registration.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <AdminShell
      title="Registration approvals"
      description="Review first-time owner signups, edit the company name if needed, then approve or reject."
    >
      <section className="admin-workbench">
        <div className="admin-list-panel">
          <div className="admin-list-header">
            <div>
              <h2>Requests</h2>
              <p>
                {requestsQuery.isLoading
                  ? 'Loading requests…'
                  : `${requests.length} ${statusFilter} ${requests.length === 1 ? 'request' : 'requests'}`}
              </p>
            </div>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>

          {notice ? (
            <div className="admin-notice">
              <p>{notice}</p>
              {actionLink ? (
                <div className="invite-card">
                  <Mail size={24} aria-hidden="true" />
                  <div>
                    <p>Owner sign-in link</p>
                    <code>{actionLink}</code>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {requestsQuery.isLoading ? (
            <p className="admin-empty-state">Loading requests…</p>
          ) : requestsQuery.isError ? (
            <p className="admin-empty-state admin-empty-state--error">Could not load registration requests.</p>
          ) : requests.length === 0 ? (
            <div className="admin-empty-state">
              <ShieldAlert size={32} aria-hidden="true" />
              <strong>No {statusFilter} requests</strong>
              <p>New owner registrations appear here until a platform admin reviews them.</p>
            </div>
          ) : (
            <div className="admin-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Owner</th>
                    <th>Timezone</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.companyName}</td>
                      <td>
                        <strong>{request.fullName}</strong>
                        <span className="admin-cell-subtle">{request.email}</span>
                      </td>
                      <td>{request.timezone}</td>
                      <td>
                        <span className={`admin-status ${request.status}`}>{request.status}</span>
                      </td>
                      <td>{formatDateTime24(request.createdAt)}</td>
                      <td>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => {
                            setError(null)
                            setSelected(request)
                          }}
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal open={Boolean(selected)} onClose={closeEditor} title="Review registration" wide>
        {selected ? (
          <form className="create-event-form" onSubmit={form.handleSubmit(() => void runAction('update'))}>
            <p className="modal-hint">
              {selected.email} submitted this request. Edit the company name before approving if needed.
            </p>
            <label>
              <FieldLabel required>Company name</FieldLabel>
              <input type="text" {...form.register('companyName')} />
            </label>
            <label>
              <FieldLabel required>Owner name</FieldLabel>
              <input type="text" {...form.register('fullName')} />
            </label>
            <label>
              <FieldLabel required>Timezone</FieldLabel>
              <input type="text" {...form.register('timezone')} />
            </label>
            <label>
              <FieldLabel>Review note</FieldLabel>
              <textarea rows={3} {...form.register('reviewNote')} />
            </label>
            {error ? <p className="field-error">{error}</p> : null}
            <div className="modal-actions">
              <button className="icon-button" type="button" onClick={closeEditor}>
                Cancel
              </button>
              {selected.status === 'pending' ? (
                <>
                  <button className="icon-button" type="submit" disabled={busyAction !== null}>
                    {busyAction === 'update' ? 'Saving…' : 'Save edits'}
                  </button>
                  <button
                    className="icon-button icon-button--danger"
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void runAction('reject')}
                  >
                    <X size={15} aria-hidden="true" />
                    {busyAction === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void runAction('approve')}
                  >
                    <Check size={15} aria-hidden="true" />
                    {busyAction === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                </>
              ) : selected.status === 'approved' ? (
                <button
                  className="icon-button"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void runAction('resend')}
                >
                  <Mail size={15} aria-hidden="true" />
                  {busyAction === 'resend' ? 'Sending…' : 'Resend sign-in email'}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </Modal>
    </AdminShell>
  )
}
