import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useWorkspace, useCan } from '../auth/WorkspaceProvider'
import type { AppPermission, CompanyRole } from '../../types/domain'
import {
  useCreateCompanyRole,
  useDeleteCompanyRole,
  useToggleRolePermission,
  useUpdateCompanyRole,
} from '../../lib/queries/mutations'
import { useCompanyRoles } from '../../lib/queries/workspace'
import {
  translatePermissionLabel,
  usePermissionGroupsWithLabels,
} from '../../lib/permission-i18n'
import {
  createCompanyRoleSchema,
  type CompanyRoleInput,
  type EditCompanyRoleProfileInput,
} from '../../lib/validation'
import { IconAvatar } from '../../components/icons/IconAvatar'
import { IconPicker } from '../../components/icons/IconPicker'
import { CompanyRoleIdentityEditModal } from './EntityIdentityEditModal'

function PermissionToggle({
  role,
  permission,
  enabled,
  disabled,
  onToggle,
  showLabel = false,
}: {
  role: CompanyRole
  permission: AppPermission
  enabled: boolean
  disabled: boolean
  onToggle: (roleId: string, permission: AppPermission, enabled: boolean) => void
  showLabel?: boolean
}) {
  const { t } = useTranslation('people')
  const permissionLabel = translatePermissionLabel(permission, t)

  return (
    <label className={showLabel ? 'company-role-card__permission' : 'permission-toggle'}>
      {showLabel ? (
        <span className="company-role-card__permission-label">{permissionLabel}</span>
      ) : null}
      <input
        type="checkbox"
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onToggle(role.id, permission, event.target.checked)}
        aria-label={t('roles.toggleAria', { role: role.name, permission: permissionLabel })}
      />
    </label>
  )
}

function CompanyRoleCard({
  role,
  canManageRoles,
  onEdit,
  onDelete,
  onToggle,
  isDeleting,
  togglePending,
}: {
  role: CompanyRole
  canManageRoles: boolean
  onEdit: (role: CompanyRole) => void
  onDelete: (roleId: string, roleName: string) => Promise<void>
  onToggle: (roleId: string, permission: AppPermission, enabled: boolean) => void
  isDeleting: boolean
  togglePending: boolean
}) {
  const { t } = useTranslation('people')
  const permissionGroups = usePermissionGroupsWithLabels(t)

  return (
    <li className="company-role-card">
      <div className="company-role-card__header-row">
        <IconAvatar
          iconId={role.iconId}
          entityType="company_role"
          label={role.name}
          size="xl"
          className="people-card-avatar"
          initialsFallback={false}
        />
        <div className="company-role-card__identity">
          <strong>{role.name}</strong>
          {role.description ? (
            <span className="company-role-card__description">{role.description}</span>
          ) : null}
        </div>
        {canManageRoles ? (
          <div className="company-role-card__actions">
            <button
              className="icon-ghost people-card__edit"
              type="button"
              aria-label={t('roles.editAria', { name: role.name })}
              title={t('roles.editTitle')}
              onClick={() => onEdit(role)}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button
              className="icon-ghost permission-matrix__delete"
              type="button"
              aria-label={t('roles.deleteAria', { name: role.name })}
              onClick={() => void onDelete(role.id, role.name)}
              disabled={isDeleting}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {permissionGroups.map((group) => (
        <section key={group.label} className="company-role-card__group">
          <h3 className="company-role-card__group-title">{group.label}</h3>
          <ul className="company-role-card__permissions">
            {group.permissions.map((permission) => (
              <li key={permission}>
                <PermissionToggle
                  role={role}
                  permission={permission}
                  enabled={role.permissions.includes(permission)}
                  disabled={togglePending}
                  onToggle={onToggle}
                  showLabel
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </li>
  )
}

function RoleNameCell({
  role,
  canManageRoles,
  onEdit,
  onDelete,
  isDeleting,
}: {
  role: CompanyRole
  canManageRoles: boolean
  onEdit: (role: CompanyRole) => void
  onDelete: (roleId: string, roleName: string) => Promise<void>
  isDeleting: boolean
}) {
  const { t } = useTranslation('people')

  if (!canManageRoles) {
    return (
      <div className="role-name-cell">
        <IconAvatar
          iconId={role.iconId}
          entityType="company_role"
          size="xl"
          className="people-card-avatar"
          initialsFallback={false}
        />
        <span>{role.name}</span>
      </div>
    )
  }

  return (
    <div className="role-name-cell">
      <IconAvatar
        iconId={role.iconId}
        entityType="company_role"
        size="xl"
        className="people-card-avatar"
        initialsFallback={false}
      />
      <span>{role.name}</span>
      <button
        className="icon-ghost role-name-cell__edit"
        type="button"
        aria-label={t('roles.editAria', { name: role.name })}
        onClick={() => onEdit(role)}
        disabled={isDeleting}
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      <button
        className="icon-ghost permission-matrix__delete"
        type="button"
        aria-label={t('roles.deleteAria', { name: role.name })}
        onClick={() => void onDelete(role.id, role.name)}
        disabled={isDeleting}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function CompanyRolesMatrix() {
  const { t } = useTranslation(['people', 'common'])
  const { t: tv } = useTranslation('validation')
  const { organizationId } = useWorkspace()
  const canManageRoles = useCan('roles.manage')
  const rolesQuery = useCompanyRoles(organizationId)
  const createRole = useCreateCompanyRole(organizationId)
  const updateRole = useUpdateCompanyRole(organizationId)
  const deleteRole = useDeleteCompanyRole(organizationId)
  const togglePermission = useToggleRolePermission(organizationId)
  const [addOpen, setAddOpen] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const companyRoleSchema = useMemo(() => createCompanyRoleSchema(tv), [tv])
  const permissionGroups = usePermissionGroupsWithLabels(t)

  const form = useForm<CompanyRoleInput>({
    resolver: zodResolver(companyRoleSchema),
    defaultValues: { name: '', description: '', iconId: 'role-user-cog' },
  })

  const roles = rolesQuery.data ?? []
  const permissions = permissionGroups.flatMap((group) => group.permissions)

  const onCreateRole = form.handleSubmit(async (values) => {
    setMatrixError(null)
    try {
      await createRole.mutateAsync(values)
      form.reset()
      setAddOpen(false)
    } catch (error) {
      setMatrixError(error instanceof Error ? error.message : t('roles.errorCreate'))
    }
  })

  const onToggle = async (roleId: string, permission: AppPermission, enabled: boolean) => {
    if (!canManageRoles) return

    setMatrixError(null)
    try {
      await togglePermission.mutateAsync({ roleId, permission, enabled })
    } catch (error) {
      setMatrixError(error instanceof Error ? error.message : t('roles.errorUpdatePermission'))
    }
  }

  const openEdit = (role: CompanyRole) => {
    setEditError(null)
    setEditingRole(role)
  }

  const closeEdit = () => {
    setEditingRole(null)
    setEditError(null)
  }

  const onSaveProfile = async (values: EditCompanyRoleProfileInput) => {
    if (!editingRole) return

    setEditError(null)
    try {
      await updateRole.mutateAsync({
        roleId: editingRole.id,
        name: values.name,
        iconId: values.iconId,
      })
      closeEdit()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('roles.errorUpdate'))
    }
  }

  const onDeleteRole = async (roleId: string, roleName: string) => {
    if (!canManageRoles) return
    if (!window.confirm(t('roles.deleteConfirm', { name: roleName }))) {
      return
    }

    setMatrixError(null)
    try {
      await deleteRole.mutateAsync(roleId)
    } catch (error) {
      setMatrixError(error instanceof Error ? error.message : t('roles.errorDelete'))
      throw error
    }
  }

  if (!canManageRoles) {
    return (
      <div className="people-panel">
        <p className="page-hint">{t('roles.noPermission')}</p>
        {roles.length > 0 ? (
          <div className="role-grid">
            {roles.map((role) => (
              <article className="role-card" key={role.id}>
                <h2>{role.name}</h2>
                <p>{t('roles.permissionCount', { count: role.permissions.length })}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="people-panel">
      <div className="admin-list-header">
        <div>
          <h2>{t('roles.title')}</h2>
          <p>
            <Trans
              i18nKey="roles.intro"
              ns="people"
              components={{ 1: <strong />, 2: <strong /> }}
            />
          </p>
        </div>
        <button className="icon-button" type="button" onClick={() => setAddOpen((open) => !open)}>
          <Plus size={18} aria-hidden="true" />
          {t('roles.add')}
        </button>
      </div>

      {addOpen ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onCreateRole}>
          <label>
            {t('roles.nameLabel')}
            <input type="text" placeholder={t('roles.namePlaceholder')} {...form.register('name')} />
          </label>
          <label>
            {t('common:field.description')}
            <input type="text" placeholder={t('common:field.optional')} {...form.register('description')} />
          </label>
          <IconPicker
            entityType="company_role"
            value={form.watch('iconId') ?? 'role-user-cog'}
            onChange={(iconId) => form.setValue('iconId', iconId, { shouldDirty: true })}
            disabled={createRole.isPending}
          />
          {matrixError ? <p className="field-error">{matrixError}</p> : null}
          <button className="icon-button" type="submit" disabled={createRole.isPending}>
            {t('roles.create')}
          </button>
        </form>
      ) : null}

      {matrixError && !addOpen ? <p className="field-error people-panel__error">{matrixError}</p> : null}

      <CompanyRoleIdentityEditModal
        open={editingRole != null}
        onClose={closeEdit}
        title={
          editingRole
            ? t('roles.editModalTitle', { name: editingRole.name })
            : t('roles.editModalFallback')
        }
        initialName={editingRole?.name ?? ''}
        initialIconId={editingRole?.iconId ?? 'role-user-cog'}
        onSubmit={onSaveProfile}
        isPending={updateRole.isPending}
        error={editError}
      />

      {rolesQuery.isLoading ? (
        <p className="page-hint">{t('roles.loading')}</p>
      ) : roles.length === 0 ? (
        <p className="page-hint">{t('roles.empty')}</p>
      ) : (
        <>
          <ul className="company-role-cards" aria-label={t('roles.cardsAria')}>
            {roles.map((role) => (
              <CompanyRoleCard
                key={role.id}
                role={role}
                canManageRoles={canManageRoles}
                onEdit={openEdit}
                onDelete={onDeleteRole}
                onToggle={onToggle}
                isDeleting={deleteRole.isPending}
                togglePending={togglePermission.isPending}
              />
            ))}
          </ul>
          <div className="table-shell admin-table-shell permission-matrix-shell company-role-table-shell">
            <table className="permission-matrix">
              <thead>
                <tr>
                  <th className="permission-matrix__role-col">{t('roles.columnRole')}</th>
                  {permissions.map((permission) => (
                    <th key={permission} className="permission-matrix__perm-col" title={permission}>
                      <span className="permission-matrix__perm-label">
                        {translatePermissionLabel(permission, t)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <th scope="row" className="permission-matrix__role-col">
                      <RoleNameCell
                        role={role}
                        canManageRoles={canManageRoles}
                        onEdit={openEdit}
                        onDelete={onDeleteRole}
                        isDeleting={deleteRole.isPending}
                      />
                    </th>
                    {permissions.map((permission) => {
                      const enabled = role.permissions.includes(permission)
                      return (
                        <td key={permission} className="permission-matrix__perm-col">
                          <PermissionToggle
                            role={role}
                            permission={permission}
                            enabled={enabled}
                            disabled={togglePermission.isPending}
                            onToggle={onToggle}
                          />
                        </td>
                      )
                    })}
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
