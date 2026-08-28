import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspace, useCan } from '../auth/WorkspaceProvider'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import {
  useCompanyRoles,
  useLocations,
  usePersonnelList,
} from '../../lib/queries/workspace'
import { invitePersonnelSchema, type InvitePersonnelInput } from '../../lib/validation'

export function PeopleScreen() {
  const { organizationId } = useWorkspace()
  const canInviteUsers = useCan('users.invite')
  const canManagePersonnel = useCan('personnel.manage')
  const canInvite = canInviteUsers && canManagePersonnel
  const personnelQuery = usePersonnelList(organizationId)
  const rolesQuery = useCompanyRoles(organizationId)
  const locationsQuery = useLocations(organizationId)
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const form = useForm<InvitePersonnelInput>({
    resolver: zodResolver(invitePersonnelSchema),
    defaultValues: {
      email: '',
      companyRoleId: '',
      locationId: '',
      fullName: '',
      title: '',
    },
  })

  const onInvite = form.handleSubmit(async (values) => {
    if (!organizationId) return

    setInviteError(null)
    setInviteResult(null)

    try {
      const result = await invokeEdgeFunction<{ acceptUrl: string }>('invite-personnel', {
        organizationId,
        ...values,
      })
      setInviteResult(result.acceptUrl)
      setInviteOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Invite failed.')
    }
  })

  const personnel = personnelQuery.data ?? []

  return (
    <section className="content-section content-section--embedded">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">Users and personnel</p>
          <h1>Pharmacy team access</h1>
        </div>
        {canInvite ? (
          <button className="icon-button" type="button" onClick={() => setInviteOpen((open) => !open)}>
            <MailPlus size={18} aria-hidden="true" />
            Invite personnel
          </button>
        ) : null}
      </div>

      {inviteOpen ? (
        <form className="create-event-form" onSubmit={onInvite}>
          <label>
            Full name
            <input type="text" {...form.register('fullName')} />
          </label>
          <label>
            Email
            <input type="email" {...form.register('email')} />
          </label>
          <label>
            Company role
            <select {...form.register('companyRoleId')} defaultValue="">
              <option value="" disabled>
                Choose role
              </option>
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select {...form.register('locationId')} defaultValue="">
              <option value="" disabled>
                Choose location
              </option>
              {(locationsQuery.data ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input type="text" {...form.register('title')} placeholder="Pharmacist" />
          </label>
          {inviteError ? <p className="field-error">{inviteError}</p> : null}
          <button className="icon-button" type="submit" disabled={form.formState.isSubmitting}>
            Send invite
          </button>
        </form>
      ) : null}

      {inviteResult ? (
        <p className="modal-hint">
          Invite link: <code>{inviteResult}</code>
        </p>
      ) : null}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Title</th>
              <th>Skills</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((person) => (
              <tr key={person.id}>
                <td>{person.fullName}</td>
                <td>{person.companyRoleName}</td>
                <td>{person.title}</td>
                <td>{person.skills.join(', ')}</td>
                <td>
                  <span className={`status ${person.status}`}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    {person.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
