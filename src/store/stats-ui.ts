import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type StatsTab = 'overview' | 'person' | 'daily' | 'role' | 'detail' | 'export'

const STATS_TABS: readonly StatsTab[] = ['overview', 'person', 'daily', 'role', 'detail', 'export']

function isStatsTab(value: unknown): value is StatsTab {
  return typeof value === 'string' && (STATS_TABS as readonly string[]).includes(value)
}

interface StatsUiState {
  activeTab: StatsTab
  setActiveTab: (tab: StatsTab) => void
}

export const useStatsUiStore = create<StatsUiState>()(
  persist(
    (set) => ({
      activeTab: 'overview',
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: 'mnemonotes-stats-ui',
      partialize: (state) => ({ activeTab: state.activeTab }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<StatsUiState> | undefined
        return {
          ...current,
          ...persistedState,
          activeTab: isStatsTab(persistedState?.activeTab)
            ? persistedState.activeTab
            : current.activeTab,
        }
      },
    },
  ),
)
