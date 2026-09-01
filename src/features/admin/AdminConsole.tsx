import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArchiveRestore,
  Building2,
  CalendarClock,
  ClipboardList,
  Clock3,
  FileText,
  Mail,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { BrandMark } from '../../components/BrandMark'
import { DevVersionLabel } from '../../components/DevVersionLabel'
import { calendarItems, personnel, pharmacyLocations } from '../../data/demo'
import { formatDateTime24 } from '../../lib/calendar-datetime'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import {
  useAuditLogAdminList,
  useCalendarItems,
  useCompaniesAdminList,
  useOrganizationMembersAdminList,
  useOrganizationsAdminList,
  usePersonnelList,
} from '../../lib/queries/workspace'
import { isSupabaseConfigured } from '../../lib/supabase'
import { provisionCompanySchema, type ProvisionCompanyInput } from '../../lib/validation'
import { Modal } from '../../components/Modal'
import { FieldLabel } from '../../components/FieldLabel'
import { SignOutButton } from '../auth/AuthScreens'
import { WorkingDaySettings } from '../settings/WorkingDaySettings'

type AdminTab = 'companies' | 'users' | 'personnel' | 'shifts' | 'notes' | 'calendar' | 'audit'

interface AdminActionRow {
  id: string
  primary: string
  secondary: string
  status: 'active' | 'inactive' | 'invited' | 'published' | 'draft' | 'critical' | 'disabled' | 'missing'
  owner: string
  updatedAt: string
}

const adminTabs: Array<{
  id: AdminTab
  label: string
  icon: LucideIcon
}> = [
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'users', label: 'Users', icon: UserCog },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'shifts', label: 'Shifts', icon: CalendarClock },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: Clock3 },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
]

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState<AdminTab>('companies')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendingOrgId, setResendingOrgId] = useState<string | null>(null)
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false)
  const queryClient = useQueryClient()

  const orgsQuery = useOrganizationsAdminList(activeTab === 'companies' || activeTab === 'calendar')
  const companiesQuery = useCompaniesAdminList(activeTab === 'companies')
  const membersQuery = useOrganizationMembersAdminList(activeTab === 'users')
  const auditQuery = useAuditLogAdminList(activeTab === 'audit')
  const personnelQuery = usePersonnelList(selectedOrgId)
  const calendarQuery = useCalendarItems(selectedOrgId)

  const provisionForm = useForm<ProvisionCompanyInput>({
    resolver: zodResolver(provisionCompanySchema),
    defaultValues: {
      organizationName: '',
      timezone: 'Europe/Athens',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
    },
  })

  const rows = useAdminRows({
    activeTab,
    companies: companiesQuery.data ?? [],
    orgs: orgsQuery.data ?? [],
    members: membersQuery.data ?? [],
    audit: auditQuery.data ?? [],
    personnel: personnelQuery.data ?? [],
    calendarItems: calendarQuery.data ?? [],
  })

  const onProvision = provisionForm.handleSubmit(async (values) => {
    setProvisionError(null)
    setProvisionSuccess(null)
    setInviteLink(null)

    try {
      const payload = {
        ...values,
        locationName: values.organizationName,
        ownerPassword: values.ownerPassword?.trim() || undefined,
      }
      const result = await invokeEdgeFunction<{
        organizationId: string
        organizationName: string
        acceptUrl?: string
        mode?: string
      }>('admin-provision-company', payload)

      if (result.acceptUrl) {
        setProvisionSuccess(`Created ${result.organizationName}. Share the owner registration link below.`)
        setInviteLink(result.acceptUrl)
      } else {
        setProvisionSuccess(`Created ${result.organizationName}. Owner can sign in immediately.`)
      }

      provisionForm.reset({
        organizationName: '',
        timezone: 'Europe/Athens',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
      })
      setCreateCompanyOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin-organizations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : 'Could not provision company.')
    }
  })

  const closeCreateCompanyModal = () => {
    setCreateCompanyOpen(false)
    setProvisionError(null)
    setProvisionSuccess(null)
    setInviteLink(null)
    provisionForm.reset({
      organizationName: '',
      timezone: 'Europe/Athens',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
    })
  }

  const companies = companiesQuery.data ?? []

  const onResendOwnerInvite = async (organizationId: string, ownerName: string | null, ownerEmail: string | null) => {
    setResendError(null)
    setResendingOrgId(organizationId)

    try {
      const result = await invokeEdgeFunction<{ acceptUrl: string }>('admin-invite-owner', {
        organizationId,
        ownerName: ownerName ?? undefined,
        ownerEmail: ownerEmail ?? undefined,
      })
      setInviteLink(result.acceptUrl)
      setProvisionSuccess('Owner invite link refreshed. Share the link below.')
      await queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
    } catch (error) {
      setResendError(error instanceof Error ? error.message : 'Could not resend owner invite.')
    } finally {
      setResendingOrgId(null)
    }
  }

  return (
    <main className="admin-console">
      <header className="admin-topbar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-title-row">
              <strong className="brand-name">MnemoNotes Admin</strong>
              <DevVersionLabel />
            </div>
            <span className="brand-subtitle">Platform company management</span>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <SignOutButton />
        </div>
      </header>

      <section className="admin-hero">
        <div>
          <p className="eyebrow">Platform Admin</p>
          <h1>Companies &amp; organisations</h1>
          <p>
            Create pharmacy workspaces, invite owners to register, and review tenant activity.
          </p>
        </div>
        <div className="admin-identity">
          <ShieldAlert size={22} aria-hidden="true" />
          <div>
            <strong>Developer Admin</strong>
            <span>Trusted Edge Functions required for company provisioning</span>
          </div>
        </div>
      </section>

      <section className="admin-workbench">
        <div className="admin-tabs" role="tablist" aria-label="Admin lists">
          {adminTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                aria-selected={activeTab === tab.id}
                className="admin-tab"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon size={17} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'companies' ? (
          <div className="admin-list-panel" role="tabpanel">
            <div className="admin-list-header">
              <div>
                <h2>Companies</h2>
                <p>
                  {companiesQuery.isLoading
                    ? 'Loading companies…'
                    : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} registered`}
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setProvisionError(null)
                  setCreateCompanyOpen(true)
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Create company
              </button>
            </div>

            {provisionSuccess ? (
              <div className="admin-notice">
                <p>{provisionSuccess}</p>
                {inviteLink ? (
                  <div className="invite-card">
                    <Mail size={24} aria-hidden="true" />
                    <div>
                      <p>Owner registration link</p>
                      <code>{inviteLink}</code>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {resendError ? <p className="admin-notice admin-notice--error">{resendError}</p> : null}

            {companiesQuery.isLoading ? (
              <p className="admin-empty-state">Loading companies…</p>
            ) : companiesQuery.isError ? (
              <p className="admin-empty-state admin-empty-state--error">
                {readQueryError(companiesQuery.error, 'Could not load companies.')}
              </p>
            ) : companies.length === 0 ? (
              <div className="admin-empty-state">
                <Building2 size={32} aria-hidden="true" />
                <strong>No companies yet</strong>
                <p>Create a company workspace and invite an owner to get started.</p>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => {
                    setProvisionError(null)
                    setCreateCompanyOpen(true)
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                  Create company
                </button>
              </div>
            ) : (
              <div className="admin-table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Owner</th>
                      <th>Timezone</th>
                      <th>Owner status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id}>
                        <td>{company.name}</td>
                        <td>
                          {company.ownerName ? (
                            <>
                              <strong>{company.ownerName}</strong>
                              {company.ownerEmail ? (
                                <span className="admin-cell-subtle">{company.ownerEmail}</span>
                              ) : null}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{company.timezone}</td>
                        <td>
                          <span className={`admin-status ${company.ownerStatus}`}>{company.ownerStatus}</span>
                        </td>
                        <td>{formatDate(company.updatedAt)}</td>
                        <td>
                          {company.ownerStatus === 'invited' ? (
                            <button
                              className="icon-button"
                              type="button"
                              disabled={resendingOrgId === company.id}
                              onClick={() =>
                                void onResendOwnerInvite(company.id, company.ownerName, company.ownerEmail)
                              }
                            >
                              <Mail size={15} aria-hidden="true" />
                              {resendingOrgId === company.id ? 'Sending…' : 'Resend invite'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Modal
              open={createCompanyOpen}
              onClose={closeCreateCompanyModal}
              title="Create company"
              wide
            >
              <p className="modal-hint">
                Creates a new company workspace and sends the owner a registration invite.
              </p>
              <form className="create-event-form" onSubmit={onProvision}>
                <label>
                  <FieldLabel required>Company name</FieldLabel>
                  <input type="text" {...provisionForm.register('organizationName')} />
                </label>
                <label>
                  <FieldLabel required>Owner name</FieldLabel>
                  <input type="text" {...provisionForm.register('ownerName')} />
                </label>
                <label>
                  <FieldLabel required>Owner email</FieldLabel>
                  <input type="email" {...provisionForm.register('ownerEmail')} />
                </label>
                <label>
                  <FieldLabel required>Timezone</FieldLabel>
                  <input type="text" {...provisionForm.register('timezone')} />
                </label>
                <label>
                  <FieldLabel>Owner password (optional, local dev only)</FieldLabel>
                  <input
                    type="password"
                    placeholder="Leave blank to send a registration invite"
                    {...provisionForm.register('ownerPassword')}
                  />
                </label>
                {provisionError ? <p className="field-error">{provisionError}</p> : null}
                <div className="modal-actions">
                  <button className="icon-button" type="button" onClick={closeCreateCompanyModal}>
                    Cancel
                  </button>
                  <button className="icon-button" type="submit" disabled={provisionForm.formState.isSubmitting}>
                    <Plus size={16} aria-hidden="true" />
                    {provisionForm.formState.isSubmitting ? 'Creating…' : 'Create & invite owner'}
                  </button>
                </div>
              </form>
            </Modal>
          </div>
        ) : activeTab === 'calendar' ? (
          <div className="admin-list-panel" role="tabpanel">
            <div className="admin-list-header">
              <div>
                <h2>Calendar</h2>
                <p>Organization working-day window used by day and week views</p>
              </div>
            </div>
            <label>
              Organization
              <select
                value={selectedOrgId ?? ''}
                onChange={(event) => setSelectedOrgId(event.target.value || null)}
              >
                <option value="">Select organization</option>
                {(orgsQuery.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedOrgId ? <WorkingDaySettings organizationId={selectedOrgId} /> : null}
          </div>
        ) : (
          <div className="admin-list-panel" role="tabpanel">
            <div className="admin-list-header">
              <div>
                <h2>{adminTabs.find((tab) => tab.id === activeTab)?.label}</h2>
                <p>{rows.length} records available in this list view</p>
              </div>
              {(activeTab === 'personnel' || activeTab === 'shifts' || activeTab === 'notes') && (
                <label>
                  Organization
                  <select
                    value={selectedOrgId ?? ''}
                    onChange={(event) => setSelectedOrgId(event.target.value || null)}
                  >
                    <option value="">Select organization</option>
                    {(orgsQuery.data ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="admin-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.primary}</td>
                      <td>{row.secondary}</td>
                      <td>
                        <span className={`admin-status ${row.status}`}>{row.status}</span>
                      </td>
                      <td>{row.owner}</td>
                      <td>{row.updatedAt}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" aria-label={`Edit ${row.primary}`} title="Edit">
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Toggle active status for ${row.primary}`}
                            title="Active/Inactive"
                          >
                            <ArchiveRestore size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="danger"
                            type="button"
                            aria-label={`Hard delete ${row.primary}`}
                            title="Hard delete"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return formatDateTime24(value)
}

function readQueryError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

function readJoinedName(value: { name: string } | { name: string }[] | null | undefined) {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]?.name
  return value.name
}

function readProfileName(
  value: { full_name: string } | { full_name: string }[] | null | undefined,
) {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]?.full_name
  return value.full_name
}

function useAdminRows(input: {
  activeTab: AdminTab
  companies: Array<{
    id: string
    name: string
    timezone: string
    status: string
    updatedAt: string
    ownerStatus: string
  }>
  orgs: Array<{ id: string; name: string; timezone: string; status: string; updated_at: string }>
  members: Array<{
    id: string
    role: string
    status: string
    updated_at: string
    organizations?: { name: string } | { name: string }[] | null
    profiles?: { full_name: string } | { full_name: string }[] | null
  }>
  audit: Array<{
    id: string
    action: string
    entity_table: string
    entity_id: string | null
    created_at: string
    organization_id: string | null
  }>
  personnel: Array<{ id: string; fullName: string; title: string; companyRoleName: string; status: string; skills: string[] }>
  calendarItems: Array<{ id: string; kind: string; title: string; assignedPersonnelIds: string[]; priority: string; noteCategory?: string }>
}): AdminActionRow[] {
  const { activeTab, companies, orgs, members, audit, personnel: livePersonnel, calendarItems: liveCalendar } = input

  return useMemo(() => {
    if (!isSupabaseConfigured) {
      if (activeTab === 'users') {
        return personnel.map((person) => ({
          id: `user-${person.id}`,
          primary: person.fullName,
          secondary: person.companyRoleName,
          status: person.status,
          owner: 'Central Pharmacy',
          updatedAt: 'Today',
        }))
      }

      if (activeTab === 'companies') {
        return pharmacyLocations.map((location) => ({
          id: location.id,
          primary: location.name,
          secondary: location.timezone,
          status: 'active',
          owner: 'MnemoNotes',
          updatedAt: 'Today',
        }))
      }
    }

    if (activeTab === 'users') {
      return members.map((member) => ({
        id: member.id,
        primary: readProfileName(member.profiles) ?? member.id,
        secondary: `${member.role} · ${readJoinedName(member.organizations) ?? 'Organization'}`,
        status: member.status === 'disabled' ? 'inactive' : (member.status as AdminActionRow['status']),
        owner: readJoinedName(member.organizations) ?? 'Organization',
        updatedAt: formatDate(member.updated_at),
      }))
    }

    if (activeTab === 'personnel') {
      return livePersonnel.map((person) => ({
        id: person.id,
        primary: person.fullName,
        secondary: `${person.title} · ${person.companyRoleName}`,
        status: person.status as AdminActionRow['status'],
        owner: 'Tenant',
        updatedAt: 'Live',
      }))
    }

    if (activeTab === 'shifts') {
      return liveCalendar
        .filter((item) => item.kind === 'shift')
        .map((item) => ({
          id: item.id,
          primary: item.title,
          secondary: `${item.assignedPersonnelIds.length} assigned personnel`,
          status: 'published',
          owner: 'Tenant',
          updatedAt: 'Live',
        }))
    }

    if (activeTab === 'notes') {
      return liveCalendar
        .filter((item) => item.kind === 'note' || item.kind === 'task')
        .map((item) => ({
          id: item.id,
          primary: item.title,
          secondary: item.noteCategory ?? item.kind,
          status: item.priority === 'critical' ? 'critical' : 'published',
          owner: 'Tenant',
          updatedAt: 'Live',
        }))
    }

    if (activeTab === 'companies') {
      return companies.map((company) => ({
        id: company.id,
        primary: company.name,
        secondary: company.timezone,
        status: company.ownerStatus as AdminActionRow['status'],
        owner: 'Platform',
        updatedAt: formatDate(company.updatedAt),
      }))
    }

    if (activeTab === 'audit') {
      return audit.map((entry) => ({
        id: entry.id,
        primary: entry.action,
        secondary: `${entry.entity_table}${entry.entity_id ? ` · ${entry.entity_id}` : ''}`,
        status: 'published',
        owner: entry.organization_id ?? 'Platform',
        updatedAt: formatDate(entry.created_at),
      }))
    }

    return calendarItems.map((item) => ({
      id: item.id,
      primary: item.title,
      secondary: item.kind,
      status: 'published',
      owner: 'Demo',
      updatedAt: 'Today',
    }))
  }, [activeTab, audit, companies, liveCalendar, livePersonnel, members, orgs])
}
