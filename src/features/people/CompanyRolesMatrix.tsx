import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useWorkspace, useCan } from '../auth/WorkspaceProvider'
import type { AppPermission, CompanyRole } from '../../types/domain'
import {
  useCreateCompanyRole,
  useDeleteCompanyRole,
  useToggleRolePermission,
  useUpdateCompanyRole,
} from '../../lib/queries/mutations'
import { useCompanyRoles } from '../../lib/queries/workspace'
import { permissionGroups, permissionLabels } from '../../lib/permissions'
import { companyRoleSchema, type CompanyRoleInput } from '../../lib/validation'

function RoleNameCell({
  role,
  canManageRoles,
  onRename,
  onDelete,
  isRenaming,
  isDeleting,
}: {
  role: CompanyRole
  canManageRoles: boolean
  onRename: (roleId: string, name: string) => Promise<void>
  onDelete: (roleId: string, roleName: string) => Promise<void>
  isRenaming: boolean
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(role.name)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setDraftName(role.name)
    setError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraftName(role.name)
    setError(null)
    setEditing(false)
  }

  const saveEdit = async () => {
    const trimmed = draftName.trim()
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (trimmed === role.name) {
      setEditing(false)
      return
    }

    setError(null)
    try {
      await onRename(role.id, trimmed)
      setEditing(false)
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename role.')
    }
  }

  if (!canManageRoles) {
    return <span>{role.name}</span>
  }

  if (editing) {
    return (
      <div className="role-name-editor">
        <input
          type="text"
          className="role-name-editor__input"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void saveEdit()
            if (event.key === 'Escape') cancelEdit()
          }}
          autoFocus
          aria-label="Role name"
        />
        <button
          className="icon-ghost role-name-editor__action"
          type="button"
          aria-label="Save role name"
          onClick={() => void saveEdit()}
          disabled={isRenaming}
        >
          <Check size={15} aria-hidden="true" />
        </button>
        <button
          className="icon-ghost role-name-editor__action"
          type="button"
          aria-label="Cancel edit"
          onClick={cancelEdit}
          disabled={isRenaming}
        >
          <X size={15} aria-hidden="true" />
        </button>
        {error ? <span className="field-error role-name-editor__error">{error}</span> : null}
      </div>
    )
  }

  return (
    <div className="role-name-cell">
      <span>{role.name}</span>
      <button
        className="icon-ghost role-name-cell__edit"
        type="button"
        aria-label={`Edit ${role.name}`}
        onClick={startEdit}
        disabled={isRenaming || isDeleting}
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      <button
        className="icon-ghost permission-matrix__delete"
        type="button"
        aria-label={`Delete ${role.name}`}
        onClick={() => void onDelete(role.id, role.name)}
        disabled={isRenaming || isDeleting}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function CompanyRolesMatrix() {
  const { organizationId } = useWorkspace()
  const canManageRoles = useCan('roles.manage')
  const rolesQuery = useCompanyRoles(organizationId)
  const createRole = useCreateCompanyRole(organizationId)
  const updateRole = useUpdateCompanyRole(organizationId)
  const deleteRole = useDeleteCompanyRole(organizationId)
  const togglePermission = useToggleRolePermission(organizationId)
  const [addOpen, setAddOpen] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)

  const form = useForm<CompanyRoleInput>({
    resolver: zodResolver(companyRoleSchema),
    defaultValues: { name: '', description: '' },
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
      setMatrixError(error instanceof Error ? error.message : 'Could not create role.')
    }
  })

  const onToggle = async (roleId: string, permission: AppPermission, enabled: boolean) => {
    if (!canManageRoles) return

    setMatrixError(null)
    try {
      await togglePermission.mutateAsync({ roleId, permission, enabled })
    } catch (error) {
      setMatrixError(error instanceof Error ? error.message : 'Could not update permission.')
    }
  }

  const onRenameRole = async (roleId: string, name: string) => {
    if (!canManageRoles) return
    setMatrixError(null)
    await updateRole.mutateAsync({ roleId, name })
  }

  const onDeleteRole = async (roleId: string, roleName: string) => {
    if (!canManageRoles) return
    if (!window.confirm(`Delete role "${roleName}"? Personnel assigned to it must be reassigned first.`)) {
      return
    }

    setMatrixError(null)
    try {
      await deleteRole.mutateAsync(roleId)
    } catch (error) {
      setMatrixError(error instanceof Error ? error.message : 'Could not delete role.')
      throw error
    }
  }

  if (!canManageRoles) {
    return (
      <div className="people-panel">
        <p className="page-hint">You do not have permission to manage company roles.</p>
        {roles.length > 0 ? (
          <div className="role-grid">
            {roles.map((role) => (
              <article className="role-card" key={role.id}>
                <h2>{role.name}</h2>
                <p>{role.permissions.length} permissions</p>
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
          <h2>Company roles</h2>
          <p>
            Create roles and assign permissions. Only <strong>Owner</strong> (you) and platform{' '}
            <strong>Admin</strong> are fixed — all team roles are defined here.
          </p>
        </div>
        <button className="icon-button" type="button" onClick={() => setAddOpen((open) => !open)}>
          <Plus size={18} aria-hidden="true" />
          Add role
        </button>
      </div>

      {addOpen ? (
        <form className="create-event-form people-panel__invite-form" onSubmit={onCreateRole}>
          <label>
            Role name
            <input type="text" placeholder="Manager, Pharmacist…" {...form.register('name')} />
          </label>
          <label>
            Description
            <input type="text" placeholder="Optional" {...form.register('description')} />
          </label>
          {matrixError ? <p className="field-error">{matrixError}</p> : null}
          <button className="icon-button" type="submit" disabled={createRole.isPending}>
            Create role
          </button>
        </form>
      ) : null}

      {matrixError && !addOpen ? <p className="field-error people-panel__error">{matrixError}</p> : null}

      {rolesQuery.isLoading ? (
        <p className="page-hint">Loading roles…</p>
      ) : roles.length === 0 ? (
        <p className="page-hint">No company roles yet. Add a role to start assigning permissions.</p>
      ) : (
        <div className="table-shell admin-table-shell permission-matrix-shell">
          <table className="permission-matrix">
            <thead>
              <tr>
                <th className="permission-matrix__role-col">Role</th>
                {permissions.map((permission) => (
                  <th key={permission} className="permission-matrix__perm-col" title={permission}>
                    <span className="permission-matrix__perm-label">{permissionLabels[permission]}</span>
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
                      onRename={onRenameRole}
                      onDelete={onDeleteRole}
                      isRenaming={updateRole.isPending}
                      isDeleting={deleteRole.isPending}
                    />
                  </th>
                  {permissions.map((permission) => {
                    const enabled = role.permissions.includes(permission)
                    return (
                      <td key={permission} className="permission-matrix__perm-col">
                        <label className="permission-toggle">
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={togglePermission.isPending}
                            onChange={(event) => onToggle(role.id, permission, event.target.checked)}
                            aria-label={`${role.name}: ${permissionLabels[permission]}`}
                          />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
