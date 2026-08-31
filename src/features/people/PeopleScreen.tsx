import { Shield, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCan, useWorkspace } from '../auth/WorkspaceProvider'
import { CompanyRolesMatrix } from './CompanyRolesMatrix'
import { PersonnelManagement } from './PersonnelManagement'

type PeopleTab = 'personnel' | 'roles'

export function PeopleScreen() {
  const { t } = useTranslation('people')
  const { isOwner } = useWorkspace()
  const canManagePersonnel = useCan('personnel.manage')
  const canManageRoles = useCan('roles.manage')
  const [activeTab, setActiveTab] = useState<PeopleTab>('personnel')

  const peopleTabs = useMemo(
    () =>
      [
        { id: 'personnel' as const, label: t('tabs.personnel'), icon: Users },
        { id: 'roles' as const, label: t('tabs.roles'), icon: Shield },
      ] as const,
    [t],
  )

  const visibleTabs = peopleTabs.filter((tab) => {
    if (tab.id === 'personnel') return isOwner || canManagePersonnel || canManageRoles
    if (tab.id === 'roles') return isOwner || canManageRoles
    return false
  })

  const currentTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : (visibleTabs[0]?.id ?? 'personnel')

  return (
    <section className="content-section people-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('page.eyebrow')}</p>
          <h1>{t('page.title')}</h1>
        </div>
      </div>

      <div className="people-workbench">
        <div className="admin-tabs people-tabs" role="tablist" aria-label={t('tabs.aria')}>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className="admin-tab"
                aria-selected={currentTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={17} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="admin-list-panel people-list-panel" role="tabpanel">
          {currentTab === 'personnel' ? <PersonnelManagement /> : <CompanyRolesMatrix />}
        </div>
      </div>
    </section>
  )
}
