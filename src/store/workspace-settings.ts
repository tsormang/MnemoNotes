import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_WORKING_DAY_END,
  DEFAULT_WORKING_DAY_START,
  isValidWorkingDayRange,
} from '../lib/calendar-hours'

interface WorkspaceSettingsState {
  workingDayStart: string
  workingDayEnd: string
  /** Monday week-start (`yyyy-MM-dd`) → show 00:00–24:00 for that week. */
  nightShiftWeeks: Record<string, boolean>
  setWorkingDay: (start: string, end: string) => boolean
  setNightShiftWeek: (weekStartKey: string, enabled: boolean) => void
  isNightShiftWeek: (weekStartKey: string) => boolean
}

export const useWorkspaceSettings = create<WorkspaceSettingsState>()(
  persist(
    (set, get) => ({
      workingDayStart: DEFAULT_WORKING_DAY_START,
      workingDayEnd: DEFAULT_WORKING_DAY_END,
      nightShiftWeeks: {},
      setWorkingDay: (start, end) => {
        if (!isValidWorkingDayRange(start, end)) return false
        set({ workingDayStart: start, workingDayEnd: end })
        return true
      },
      setNightShiftWeek: (weekStartKey, enabled) => {
        set((state) => {
          const next = { ...state.nightShiftWeeks }
          if (enabled) {
            next[weekStartKey] = true
          } else {
            delete next[weekStartKey]
          }
          return { nightShiftWeeks: next }
        })
      },
      isNightShiftWeek: (weekStartKey) => Boolean(get().nightShiftWeeks[weekStartKey]),
    }),
    {
      name: 'mnemonotes-workspace-settings',
      partialize: (state) => ({
        workingDayStart: state.workingDayStart,
        workingDayEnd: state.workingDayEnd,
        nightShiftWeeks: state.nightShiftWeeks,
      }),
    },
  ),
)
