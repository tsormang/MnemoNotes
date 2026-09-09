import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStatsUiStore } from '../../store/stats-ui'
import { StatsPanel } from './StatsPanel'

vi.mock('../../lib/queries/workspace', () => ({
  useCalendarItems: () => ({ data: [], isLoading: false }),
  usePersonnelList: () => ({ data: [], isLoading: false }),
  useCompanyRoles: () => ({ data: [], isLoading: false }),
}))

vi.mock('../../lib/queries/icons', () => ({
  useIconCatalog: () => ({
    resolvePath: () => '/icons/placeholder.png',
  }),
}))

vi.mock('../auth/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    organizationId: 'org-1',
    membership: { organizationName: 'Test Pharmacy' },
  }),
}))

vi.mock('../../store/display-preferences', () => ({
  useDisplayPreferences: (selector: (state: { showTasks: boolean }) => unknown) =>
    selector({ showTasks: true }),
}))

vi.mock('./StatsBarChart', () => ({
  StatsBarChart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div data-testid="stats-bar-chart">{ariaLabel}</div>
  ),
}))

vi.mock('./StatsPrintPreview', () => ({
  StatsPrintPreview: () => null,
}))

describe('StatsPanel tabs', () => {
  beforeEach(() => {
    useStatsUiStore.setState({ activeTab: 'overview' })
  })

  it('shows period controls by default and switches tab panels', () => {
    render(<StatsPanel />)

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('Shift hours')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Hours by person' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hours by person' })).toBeInTheDocument()
    expect(useStatsUiStore.getState().activeTab).toBe('person')

    fireEvent.click(screen.getByRole('tab', { name: 'Personnel detail' }))
    expect(screen.getByRole('heading', { name: 'Personnel detail' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument()
    expect(useStatsUiStore.getState().activeTab).toBe('detail')
  })

  it('restores the persisted tab on mount', () => {
    useStatsUiStore.setState({ activeTab: 'role' })
    render(<StatsPanel />)

    expect(screen.getByRole('heading', { name: 'Hours by role' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Hours by role' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows CSV and PDF actions on the export tab', () => {
    useStatsUiStore.setState({ activeTab: 'export' })
    render(<StatsPanel />)

    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /CSV/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /PDF/i })).toBeInTheDocument()
  })
})
