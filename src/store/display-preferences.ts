import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DisplayPreferencesState {
  /** When false, task calendar items are hidden across the app. */
  showTasks: boolean
  setShowTasks: (showTasks: boolean) => void
}

export const useDisplayPreferences = create<DisplayPreferencesState>()(
  persist(
    (set) => ({
      showTasks: false,
      setShowTasks: (showTasks) => set({ showTasks }),
    }),
    {
      name: 'mnemonotes-display-preferences',
      partialize: (state) => ({ showTasks: state.showTasks }),
    },
  ),
)
