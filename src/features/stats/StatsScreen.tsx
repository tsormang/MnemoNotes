import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCalendarShell } from '../calendar/CalendarShellContext'
import { StatsPanel } from './StatsPanel'

export function StatsScreen() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { setPersonnelFilterId, setKindFilter, setStatsDrillDown } = useCalendarShell()

  const handleDrillDown = useCallback(
    ({ personnelId, fullName }: { personnelId: string; fullName: string }) => {
      setPersonnelFilterId(personnelId)
      setKindFilter('shift')
      setStatsDrillDown({ fullName })
      navigate('/app/calendar')
    },
    [navigate, setKindFilter, setPersonnelFilterId, setStatsDrillDown],
  )

  return (
    <section className="content-section stats-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('stats.page.eyebrow')}</p>
          <h1>{t('nav.workforceStats')}</h1>
        </div>
      </div>

      <StatsPanel onDrillDown={handleDrillDown} />
    </section>
  )
}
