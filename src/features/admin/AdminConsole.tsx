import {
  ArchiveRestore,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Pencil,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { calendarItems, personnel, pharmacyLocations } from '../../data/demo'
import { roleLabels } from '../../lib/access-control'

type AdminTab = 'users' | 'personnel' | 'shifts' | 'notes' | 'pharmacies' | 'audit'

interface AdminActionRow {
  id: string
  primary: string
  secondary: string
  status: 'active' | 'inactive' | 'invited' | 'published' | 'draft' | 'critical'
  owner: string
  updatedAt: string
}

const adminTabs: Array<{
  id: AdminTab
  label: string
  icon: LucideIcon
}> = [
  { id: 'users', label: 'Users', icon: UserCog },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'shifts', label: 'Shifts', icon: CalendarClock },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'pharmacies', label: 'Pharmacies', icon: Building2 },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
]

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const rows = useAdminRows(activeTab)

  return (
    <main className="admin-console">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Platform Admin</p>
          <h1>Absolute control console</h1>
          <p>
            Full operator access for user status, hard deletes, pharmacy tenants, personnel,
            notes, shifts, and future business modules.
          </p>
        </div>
        <div className="admin-identity">
          <ShieldAlert size={22} aria-hidden="true" />
          <div>
            <strong>Developer Admin</strong>
            <span>Service-role actions required for Auth hard deletes</span>
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

        <div className="admin-list-panel" role="tabpanel">
          <div className="admin-list-header">
            <div>
              <h2>{adminTabs.find((tab) => tab.id === activeTab)?.label}</h2>
              <p>{rows.length} records available in this list view</p>
            </div>
            <button className="icon-button" type="button">
              <Pencil size={16} aria-hidden="true" />
              New admin action
            </button>
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
      </section>
    </main>
  )
}

function useAdminRows(activeTab: AdminTab): AdminActionRow[] {
  return useMemo(() => {
    if (activeTab === 'users') {
      return [
        {
          id: 'admin-user',
          primary: 'tsormang@gmail.com',
          secondary: 'Developer Admin',
          status: 'active',
          owner: 'Platform',
          updatedAt: 'Today',
        },
        ...personnel.map((person) => ({
          id: `user-${person.id}`,
          primary: person.fullName,
          secondary: roleLabels[person.role],
          status: person.status,
          owner: 'Central Pharmacy',
          updatedAt: 'Today',
        })),
      ]
    }

    if (activeTab === 'personnel') {
      return personnel.map((person) => ({
        id: person.id,
        primary: person.fullName,
        secondary: `${person.title} · ${person.skills.join(', ')}`,
        status: person.status,
        owner: pharmacyLocations.find((location) => location.id === person.locationId)?.name ?? 'Pharmacy',
        updatedAt: 'Today',
      }))
    }

    if (activeTab === 'shifts') {
      return calendarItems
        .filter((item) => item.kind === 'shift')
        .map((item) => ({
          id: item.id,
          primary: item.title,
          secondary: `${item.assignedPersonnelIds.length} assigned personnel`,
          status: 'published',
          owner: pharmacyLocations.find((location) => location.id === item.locationId)?.name ?? 'Pharmacy',
          updatedAt: 'Today',
        }))
    }

    if (activeTab === 'notes') {
      return calendarItems
        .filter((item) => item.kind === 'note' || item.kind === 'task')
        .map((item) => ({
          id: item.id,
          primary: item.title,
          secondary: item.noteCategory ?? item.kind,
          status: item.priority === 'critical' ? 'critical' : 'published',
          owner: pharmacyLocations.find((location) => location.id === item.locationId)?.name ?? 'Pharmacy',
          updatedAt: 'Today',
        }))
    }

    if (activeTab === 'pharmacies') {
      return pharmacyLocations.map((location) => ({
        id: location.id,
        primary: location.name,
        secondary: `${location.address} · ${location.openingHours}`,
        status: 'active',
        owner: 'MnemoNotes',
        updatedAt: 'Today',
      }))
    }

    return [
      {
        id: 'audit-1',
        primary: 'Platform admin permissions expanded',
        secondary: 'Developer Admin granted hard-delete and tenant-control permissions',
        status: 'critical',
        owner: 'Platform',
        updatedAt: 'Today',
      },
      {
        id: 'audit-2',
        primary: 'Admin console viewed',
        secondary: 'List views opened for platform management',
        status: 'published',
        owner: 'Platform',
        updatedAt: 'Today',
      },
    ]
  }, [activeTab])
}
