import { zodResolver } from '@hookform/resolvers/zod'
import {
  Copy,
  Mail,
  MailPlus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspace, useCan } from '../auth/WorkspaceProvider'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import { useCreatePersonnel, useUpdatePersonnel } from '../../lib/queries/mutations'
import {
  useCompanyLocation,
  useCompanyRoles,
  usePersonnelList,
} from '../../lib/queries/workspace'
import { CompanyLocationField } from '../../components/CompanyLocationField'
import type { Personnel, PersonnelAccountLink } from '../../types/domain'
import {
  createPersonnelSchema,
  linkPersonnelInviteSchema,
  type CreatePersonnelInput,
  type LinkPersonnelInviteInput,
} from '../../lib/validation'

const accountLinkMeta: Record<
  PersonnelAccountLink,
  { label: string; icon: typeof UserCheck; className: string }
> = {
  linked: { label: 'App account linked', icon: UserCheck, className: 'account-link--linked' },
  invited: { label: 'Invite pending', icon: Mail, className: 'account-link--invited' },
  unlinked: { label: 'Roster only (no app account)', icon: UserRound, className: 'account-link--unlinked' },
}

function AccountLinkBadge({ accountLink }: { accountLink: PersonnelAccountLink }) {
  const meta = accountLinkMeta[accountLink]
  const Icon = meta.icon

  return (
    <span className={`account-link ${meta.className}`} title={meta.label}>
      <Icon size={16} aria-hidden="true" />
      <span className="visually-hidden">{meta.label}</span>
    </span>
  )
}

export function PersonnelManagement() {
  const { organizationId } = useWorkspace()
  const canInviteUsers = useCan('users.invite')
  const canManagePersonnel = useCan('personnel.manage')
  const canInvite = canInviteUsers && canManagePersonnel
  const personnelQuery = usePersonnelList(organizationId)
  const rolesQuery = useCompanyRoles(organizationId)
  const companyLocation = useCompanyLocation(organizationId)
  const createPersonnel = useCreatePersonnel(organizationId)
  const updatePersonnel = useUpdatePersonnel(organizationId)
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [invitingPersonnelId, setInvitingPersonnelId] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const addForm = useForm<CreatePersonnelInput>({
    resolver: zodResolver(createPersonnelSchema),
    defaultValues: {
      companyRoleId: '',
      fullName: '',
      title: '',
    },
  })

  const inviteForm = useForm<LinkPersonnelInviteInput>({
    resolver: zodResolver(linkPersonnelInviteSchema),
    defaultValues: { personnelId: '', email: '' },
  })

  const onAddPersonnel = addForm.handleSubmit(async (values) => {
    if (!organizationId || !companyLocation.locationId) return

    setAddError(null)
    try {
      await createPersonnel.mutateAsync({
        ...values,
        locationId: companyLocation.locationId,
      })
      addForm.reset()
      setAddOpen(false)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Could not add personnel.')
    }
  })

  const openInvite = (person: Personnel) => {
    setInviteError(null)
    setInviteResult(null)
    setInvitingPersonnelId(person.id)
    inviteForm.reset({ personnelId: person.id, email: '' })
  }

  const closeInvite = () => {
    setInvitingPersonnelId(null)
    inviteForm.reset()
  }

  const onSendInvite = inviteForm.handleSubmit(async (values) => {
    if (!organizationId) return

    setInviteError(null)
    setInviteResult(null)

    try {
      const result = await invokeEdgeFunction<{ acceptUrl: string }>('invite-personnel', {
        organizationId,
        personnelId: values.personnelId,
        email: values.email,
      })
      setInviteResult(result.acceptUrl)
      setInvitingPersonnelId(null)
      inviteForm.reset()
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
      await queryClient.invalidateQueries({ queryKey: ['personnel-invites', organizationId] })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Invite failed.')
    }
  })

  const onRoleChange = async (personnelId: string, companyRoleId: string) => {
    if (!canManagePersonnel) return

    setUpdateError(null)
    try {
      await updatePersonnel.mutateAsync({ personnelId, companyRoleId })
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Could not update role.')
    }
  }

  const copyInviteLink = async () => {
    if (!inviteResult) return
    await navigator.clipboard.writeText(inviteResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const personnel = personnelQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const hasRoles = roles.length > 0
  const invitingPerson = personnel.find((person) => person.id === invitingPersonnelId)

  return (
    <div className="people-panel">
      <div className="admin-list-header">
        <div>
          <h2>Personnel</h2>
          <p>
            Add team members to the roster for scheduling. Send an invite later to link them to an app
            account.
          </p>
        </div>
        {canManagePersonnel ? (
          <button
            className="icon-button"
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            disabled={!hasRoles}
            title={hasRoles ? undefined : 'Create a company role first'}
          >
            <UserPlus size={18} aria-hidden="true" />
            Add personnel
          </button>
        ) : null}
      </div>

      <div className="account-link-legend" aria-label="Account link legend">
        <span className="account-link account-link--linked">
          <UserCheck size={14} aria-hidden="true" /> Linked account
        </span>
        <span className="account-link account-link--invited">
          <Mail size={14} aria-hidden="true" /> Invite pending
        </span>
        <span className="account-link account-link--unlinked">
          <UserRound size={14} aria-hidden="true" /> Roster only
        </span>
      </div>

      {!hasRoles ? (
        <p className="page-hint people-panel__hint">
          Create at least one company role in the <strong>Roles</strong> tab before adding personnel.
        </p>
      ) : null}

      {addOpen ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onAddPersonnel}>
          <label>
            Full name
            <input type="text" {...addForm.register('fullName')} />
          </label>
          <label>
            Company role
            <select {...addForm.register('companyRoleId')} defaultValue="">
              <option value="" disabled>
                Choose role
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <CompanyLocationField
            companyName={companyLocation.companyName}
            loading={companyLocation.loading}
          />
          <label>
            Title
            <input type="text" {...addForm.register('title')} placeholder="Pharmacist" />
          </label>
          {addError ? <p className="field-error">{addError}</p> : null}
          <button className="icon-button" type="submit" disabled={createPersonnel.isPending}>
            Add to roster
          </button>
        </form>
      ) : null}

      {invitingPerson ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onSendInvite}>
          <p className="page-hint">
            Send invite to link <strong>{invitingPerson.fullName}</strong> to an app account.
          </p>
          <input type="hidden" {...inviteForm.register('personnelId')} />
          <label>
            Email
            <input type="email" {...inviteForm.register('email')} autoFocus />
          </label>
          {inviteError ? <p className="field-error">{inviteError}</p> : null}
          <div className="people-panel__invite-actions">
            <button className="icon-button" type="submit" disabled={inviteForm.formState.isSubmitting}>
              <MailPlus size={18} aria-hidden="true" />
              Send invite
            </button>
            <button className="icon-ghost people-panel__cancel" type="button" onClick={closeInvite}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {inviteResult ? (
        <div className="invite-result">
          <p className="page-hint">Share this link with the invitee (valid 7 days):</p>
          <div className="invite-result__row">
            <code>{inviteResult}</code>
            <button className="icon-ghost" type="button" aria-label="Copy invite link" onClick={copyInviteLink}>
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>
          {copied ? <p className="page-hint">Copied to clipboard.</p> : null}
        </div>
      ) : null}

      {updateError ? <p className="field-error">{updateError}</p> : null}

      {personnelQuery.isLoading ? (
        <p className="page-hint">Loading personnel…</p>
      ) : personnel.length === 0 ? (
        <p className="page-hint">No personnel yet. Add someone to the roster to get started.</p>
      ) : (
        <div className="table-shell admin-table-shell">
          <table>
            <thead>
              <tr>
                <th aria-label="Account" />
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Title</th>
                <th>Status</th>
                {canInvite ? <th aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {personnel.map((person) => (
                <tr key={person.id}>
                  <td>
                    <AccountLinkBadge accountLink={person.accountLink} />
                  </td>
                  <td>{person.fullName}</td>
                  <td>{person.inviteEmail ?? '—'}</td>
                  <td>
                    {canManagePersonnel && roles.length > 0 ? (
                      <select
                        className="inline-select"
                        value={person.companyRoleId}
                        onChange={(event) => onRoleChange(person.id, event.target.value)}
                        disabled={updatePersonnel.isPending}
                        aria-label={`Role for ${person.fullName}`}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      person.companyRoleName
                    )}
                  </td>
                  <td>{person.title}</td>
                  <td>
                    <span className={`status ${person.status}`}>
                      <ShieldCheck size={14} aria-hidden="true" />
                      {person.accountLink === 'unlinked' ? 'roster' : person.status}
                    </span>
                  </td>
                  {canInvite ? (
                    <td>
                      {person.accountLink === 'unlinked' ? (
                        <button
                          className="icon-ghost personnel-invite-btn"
                          type="button"
                          aria-label={`Invite ${person.fullName}`}
                          title="Send invite to link app account"
                          onClick={() => openInvite(person)}
                        >
                          <MailPlus size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
