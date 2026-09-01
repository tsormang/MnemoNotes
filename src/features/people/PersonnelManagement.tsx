import { zodResolver } from '@hookform/resolvers/zod'
import {
  Copy,
  Mail,
  MailPlus,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
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
import { IconAvatar } from '../../components/icons/IconAvatar'
import { IconPicker, syncPersonnelIconForGender } from '../../components/icons/IconPicker'
import { useIconCatalog } from '../../lib/queries/icons'
import { defaultPersonnelIconId } from '../../lib/icons/defaults'
import type { Personnel, PersonnelAccountLink } from '../../types/domain'
import {
  createCreatePersonnelSchema,
  createLinkPersonnelInviteSchema,
  type CreatePersonnelInput,
  type EditPersonnelProfileInput,
  type LinkPersonnelInviteInput,
} from '../../lib/validation'
import { PersonnelIdentityEditModal } from './EntityIdentityEditModal'

const accountLinkMeta: Record<
  PersonnelAccountLink,
  { labelKey: `account.${PersonnelAccountLink}`; icon: typeof UserCheck; className: string }
> = {
  linked: { labelKey: 'account.linked', icon: UserCheck, className: 'account-link--linked' },
  invited: { labelKey: 'account.invited', icon: Mail, className: 'account-link--invited' },
  unlinked: { labelKey: 'account.unlinked', icon: UserRound, className: 'account-link--unlinked' },
}

function AccountLinkBadge({ accountLink }: { accountLink: PersonnelAccountLink }) {
  const { t } = useTranslation('people')
  const meta = accountLinkMeta[accountLink]
  const Icon = meta.icon
  const label = t(meta.labelKey)

  return (
    <span className={`account-link ${meta.className}`} title={label}>
      <Icon size={16} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

function PersonnelRoleField({
  person,
  roles,
  canManagePersonnel,
  onRoleChange,
  disabled,
}: {
  person: Personnel
  roles: { id: string; name: string }[]
  canManagePersonnel: boolean
  onRoleChange: (personnelId: string, companyRoleId: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation('people')

  if (canManagePersonnel && roles.length > 0) {
    return (
      <select
        className="inline-select"
        value={person.companyRoleId}
        onChange={(event) => onRoleChange(person.id, event.target.value)}
        disabled={disabled}
        aria-label={t('personnel.roleForAria', { name: person.fullName })}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    )
  }

  return <>{person.companyRoleName}</>
}

function PersonnelStatus({ person }: { person: Personnel }) {
  const { t } = useTranslation('people')
  const label =
    person.accountLink === 'unlinked'
      ? t('personnel.status.roster')
      : t(`personnel.status.${person.status}`)

  return (
    <span className={`status ${person.status}`}>
      <ShieldCheck size={14} aria-hidden="true" />
      {label}
    </span>
  )
}

function PersonnelInviteButton({
  person,
  onInvite,
}: {
  person: Personnel
  onInvite: (person: Personnel) => void
}) {
  const { t } = useTranslation('people')

  if (person.accountLink !== 'unlinked') return null

  return (
    <button
      className="icon-ghost personnel-invite-btn"
      type="button"
      aria-label={t('personnel.inviteAria', { name: person.fullName })}
      title={t('personnel.inviteTitle')}
      onClick={() => onInvite(person)}
    >
      <MailPlus size={16} aria-hidden="true" />
    </button>
  )
}

function PersonnelEditButton({
  person,
  onEdit,
}: {
  person: Personnel
  onEdit: (person: Personnel) => void
}) {
  const { t } = useTranslation('people')

  return (
    <button
      className="icon-ghost people-card__edit"
      type="button"
      aria-label={t('personnel.editAria', { name: person.fullName })}
      title={t('personnel.editTitle')}
      onClick={() => onEdit(person)}
    >
      <Pencil size={16} aria-hidden="true" />
    </button>
  )
}

function PersonnelCard({
  person,
  roles,
  canManagePersonnel,
  canInvite,
  onRoleChange,
  onInvite,
  onEdit,
  roleChangePending,
}: {
  person: Personnel
  roles: { id: string; name: string }[]
  canManagePersonnel: boolean
  canInvite: boolean
  onRoleChange: (personnelId: string, companyRoleId: string) => void
  onInvite: (person: Personnel) => void
  onEdit: (person: Personnel) => void
  roleChangePending: boolean
}) {
  const { t } = useTranslation(['people', 'common'])

  return (
    <li className="personnel-card">
      <div className="personnel-card__header">
        <IconAvatar
          iconId={person.iconId}
          entityType="personnel"
          label={person.fullName}
          size="xl"
          className="people-card-avatar"
        />
        <div className="personnel-card__identity">
          <strong>{person.fullName}</strong>
        </div>
        <div className="personnel-card__badges">
          <AccountLinkBadge accountLink={person.accountLink} />
          {canManagePersonnel ? <PersonnelEditButton person={person} onEdit={onEdit} /> : null}
          {canInvite ? <PersonnelInviteButton person={person} onInvite={onInvite} /> : null}
        </div>
      </div>
      <dl className="personnel-card__fields">
        <div className="personnel-card__field">
          <dt>{t('personnel.table.role')}</dt>
          <dd>
            <PersonnelRoleField
              person={person}
              roles={roles}
              canManagePersonnel={canManagePersonnel}
              onRoleChange={onRoleChange}
              disabled={roleChangePending}
            />
          </dd>
        </div>
        <div className="personnel-card__field">
          <dt>{t('common:field.email')}</dt>
          <dd>{person.inviteEmail ?? '—'}</dd>
        </div>
        <div className="personnel-card__field">
          <dt>{t('common:field.status')}</dt>
          <dd>
            <PersonnelStatus person={person} />
          </dd>
        </div>
      </dl>
    </li>
  )
}

export function PersonnelManagement() {
  const { t } = useTranslation(['people', 'common', 'validation'])
  const { t: tv } = useTranslation('validation')
  const createPersonnelSchema = useMemo(() => createCreatePersonnelSchema(tv), [tv])
  const linkPersonnelInviteSchema = useMemo(() => createLinkPersonnelInviteSchema(tv), [tv])
  const { organizationId, membership } = useWorkspace()
  const canInviteUsers = useCan('users.invite')
  const canManagePersonnel = useCan('personnel.manage')
  const canInvite = canInviteUsers && canManagePersonnel
  const personnelQuery = usePersonnelList(organizationId)
  const rolesQuery = useCompanyRoles(organizationId)
  const companyLocation = useCompanyLocation(organizationId, {
    fallbackCompanyName: membership?.organizationName,
  })
  const createPersonnel = useCreatePersonnel(organizationId)
  const updatePersonnel = useUpdatePersonnel(organizationId)
  const { iconMatchesGender } = useIconCatalog()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [invitingPersonnelId, setInvitingPersonnelId] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const addForm = useForm<CreatePersonnelInput>({
    resolver: zodResolver(createPersonnelSchema),
    defaultValues: {
      companyRoleId: '',
      fullName: '',
      iconId: defaultPersonnelIconId('female'),
      avatarGender: 'female',
    },
  })

  const watchedAvatarGender = addForm.watch('avatarGender')
  const watchedIconId = addForm.watch('iconId')

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
      setAddError(error instanceof Error ? error.message : t('personnel.errorAdd'))
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
      setInviteError(error instanceof Error ? error.message : t('personnel.errorInvite'))
    }
  })

  const onRoleChange = async (personnelId: string, companyRoleId: string) => {
    if (!canManagePersonnel) return

    setUpdateError(null)
    try {
      await updatePersonnel.mutateAsync({ personnelId, companyRoleId })
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : t('personnel.errorUpdateRole'))
    }
  }

  const openEdit = (person: Personnel) => {
    setEditError(null)
    setEditingPerson(person)
  }

  const closeEdit = () => {
    setEditingPerson(null)
    setEditError(null)
  }

  const onSaveProfile = async (values: EditPersonnelProfileInput) => {
    if (!editingPerson) return

    setEditError(null)
    try {
      await updatePersonnel.mutateAsync({
        personnelId: editingPerson.id,
        fullName: values.fullName,
        iconId: values.iconId,
        avatarGender: values.avatarGender,
      })
      closeEdit()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('personnel.errorUpdateProfile'))
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
          <h2>{t('personnel.title')}</h2>
          <p>{t('personnel.intro')}</p>
        </div>
        {canManagePersonnel ? (
          <button
            className="icon-button"
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            disabled={!hasRoles}
            title={hasRoles ? undefined : t('personnel.createRoleFirst')}
          >
            <UserPlus size={18} aria-hidden="true" />
            {t('personnel.add')}
          </button>
        ) : null}
      </div>

      <div className="account-link-legend" aria-label={t('account.legendAria')}>
        <span className="account-link account-link--linked">
          <UserCheck size={14} aria-hidden="true" /> {t('account.legendLinked')}
        </span>
        <span className="account-link account-link--invited">
          <Mail size={14} aria-hidden="true" /> {t('account.legendInvited')}
        </span>
        <span className="account-link account-link--unlinked">
          <UserRound size={14} aria-hidden="true" /> {t('account.legendRosterOnly')}
        </span>
      </div>

      {!hasRoles ? (
        <p className="page-hint people-panel__hint">
          <Trans i18nKey="personnel.noRolesHint" ns="people" components={{ 1: <strong /> }} />
        </p>
      ) : null}

      {addOpen ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onAddPersonnel}>
          <label>
            {t('common:field.fullName')}
            <input type="text" {...addForm.register('fullName')} />
          </label>
          <label>
            {t('personnel.companyRole')}
            <select {...addForm.register('companyRoleId')} defaultValue="">
              <option value="" disabled>
                {t('personnel.chooseRole')}
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
            loading={companyLocation.companyNameLoading}
          />
          <IconPicker
            entityType="personnel"
            label={t('personnel.avatar')}
            avatarGender={watchedAvatarGender}
            value={watchedIconId ?? defaultPersonnelIconId(watchedAvatarGender)}
            onChange={(iconId) => addForm.setValue('iconId', iconId, { shouldDirty: true })}
            onAvatarGenderChange={(avatarGender) => {
              addForm.setValue('avatarGender', avatarGender, { shouldDirty: true })
              addForm.setValue(
                'iconId',
                syncPersonnelIconForGender(watchedIconId, avatarGender, iconMatchesGender),
                { shouldDirty: true },
              )
            }}
            disabled={createPersonnel.isPending}
          />
          {addError ? <p className="field-error">{addError}</p> : null}
          <button className="icon-button" type="submit" disabled={createPersonnel.isPending}>
            {t('personnel.addToRoster')}
          </button>
        </form>
      ) : null}

      {invitingPerson ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onSendInvite}>
          <p className="page-hint">
            <Trans
              i18nKey="personnel.invitePrompt"
              ns="people"
              values={{ name: invitingPerson.fullName }}
              components={{ 1: <strong /> }}
            />
          </p>
          <input type="hidden" {...inviteForm.register('personnelId')} />
          <label>
            {t('common:field.email')}
            <input type="email" {...inviteForm.register('email')} autoFocus />
          </label>
          {inviteError ? <p className="field-error">{inviteError}</p> : null}
          <div className="people-panel__invite-actions">
            <button className="icon-button" type="submit" disabled={inviteForm.formState.isSubmitting}>
              <MailPlus size={18} aria-hidden="true" />
              {t('personnel.sendInvite')}
            </button>
            <button className="icon-ghost people-panel__cancel" type="button" onClick={closeInvite}>
              {t('common:actions.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {inviteResult ? (
        <div className="invite-result">
          <p className="page-hint">{t('personnel.inviteLinkHint')}</p>
          <div className="invite-result__row">
            <code>{inviteResult}</code>
            <button
              className="icon-ghost"
              type="button"
              aria-label={t('personnel.copyInviteAria')}
              onClick={copyInviteLink}
            >
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>
          {copied ? <p className="page-hint">{t('common:copiedToClipboard')}</p> : null}
        </div>
      ) : null}

      {updateError ? <p className="field-error">{updateError}</p> : null}

      <PersonnelIdentityEditModal
        open={editingPerson != null}
        onClose={closeEdit}
        title={
          editingPerson
            ? t('personnel.editModalTitle', { name: editingPerson.fullName })
            : t('personnel.editModalFallback')
        }
        initialFullName={editingPerson?.fullName ?? ''}
        initialIconId={editingPerson?.iconId ?? defaultPersonnelIconId('female')}
        initialAvatarGender={editingPerson?.avatarGender ?? 'female'}
        onSubmit={onSaveProfile}
        isPending={updatePersonnel.isPending}
        error={editError}
      />

      {personnelQuery.isLoading ? (
        <p className="page-hint">{t('personnel.loading')}</p>
      ) : personnel.length === 0 ? (
        <p className="page-hint">{t('personnel.empty')}</p>
      ) : (
        <>
          <ul className="personnel-cards" aria-label={t('personnel.rosterAria')}>
            {personnel.map((person) => (
              <PersonnelCard
                key={person.id}
                person={person}
                roles={roles}
                canManagePersonnel={canManagePersonnel}
                canInvite={canInvite}
                onRoleChange={onRoleChange}
                onInvite={openInvite}
                onEdit={openEdit}
                roleChangePending={updatePersonnel.isPending}
              />
            ))}
          </ul>
          <div className="table-shell admin-table-shell personnel-table-shell">
            <table>
              <thead>
                <tr>
                  <th aria-label={t('common:field.icon')} />
                  <th aria-label={t('common:field.account')} />
                  <th>{t('personnel.table.name')}</th>
                  <th>{t('personnel.table.email')}</th>
                  <th>{t('personnel.table.role')}</th>
                  <th>{t('personnel.table.status')}</th>
                  {canInvite ? <th aria-label={t('common:field.actions')} /> : null}
                  {canManagePersonnel ? <th aria-label={t('personnel.table.edit')} /> : null}
                </tr>
              </thead>
              <tbody>
                {personnel.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <IconAvatar
                        iconId={person.iconId}
                        entityType="personnel"
                        label={person.fullName}
                        size="xl"
                        className="people-card-avatar"
                      />
                    </td>
                    <td>
                      <AccountLinkBadge accountLink={person.accountLink} />
                    </td>
                    <td>{person.fullName}</td>
                    <td>{person.inviteEmail ?? '—'}</td>
                    <td>
                      <PersonnelRoleField
                        person={person}
                        roles={roles}
                        canManagePersonnel={canManagePersonnel}
                        onRoleChange={onRoleChange}
                        disabled={updatePersonnel.isPending}
                      />
                    </td>
                    <td>
                      <PersonnelStatus person={person} />
                    </td>
                    {canInvite ? (
                      <td>
                        <PersonnelInviteButton person={person} onInvite={openInvite} />
                      </td>
                    ) : null}
                    {canManagePersonnel ? (
                      <td>
                        <PersonnelEditButton person={person} onEdit={openEdit} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
