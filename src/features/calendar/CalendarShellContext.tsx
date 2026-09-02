import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { CalendarItem, CalendarItemKind } from '../../types/domain'

export type CalendarKindFilter = CalendarItemKind | 'all'

export interface CalendarEventDraft {
  startsAt: string
  endsAt: string
  kind?: CalendarItemKind
  allDay?: boolean
  /** When true, the event stays all-day (opened from the all-day row). */
  allDayLocked?: boolean
}

interface CalendarShellContextValue {
  searchQuery: string
  setSearchQuery: (value: string) => void
  kindFilter: CalendarKindFilter
  setKindFilter: (value: CalendarKindFilter) => void
  personnelFilterId: string | null
  setPersonnelFilterId: (value: string | null) => void
  eventModalOpen: boolean
  editingItem: CalendarItem | null
  createDraft: CalendarEventDraft | null
  openCreateEvent: (draft?: CalendarEventDraft) => void
  openEditEvent: (item: CalendarItem) => void
  closeEventModal: () => void
}

const CalendarShellContext = createContext<CalendarShellContextValue | null>(null)

export function CalendarShellProvider({ children }: PropsWithChildren) {
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<CalendarKindFilter>('all')
  const [personnelFilterId, setPersonnelFilterId] = useState<string | null>(null)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null)
  const [createDraft, setCreateDraft] = useState<CalendarEventDraft | null>(null)

  const openCreateEvent = useCallback((draft?: CalendarEventDraft) => {
    setEditingItem(null)
    setCreateDraft(draft ?? null)
    setEventModalOpen(true)
  }, [])

  const openEditEvent = useCallback((item: CalendarItem) => {
    setEditingItem(item)
    setCreateDraft(null)
    setEventModalOpen(true)
  }, [])

  const closeEventModal = useCallback(() => {
    setEventModalOpen(false)
    setEditingItem(null)
    setCreateDraft(null)
  }, [])

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      kindFilter,
      setKindFilter,
      personnelFilterId,
      setPersonnelFilterId,
      eventModalOpen,
      editingItem,
      createDraft,
      openCreateEvent,
      openEditEvent,
      closeEventModal,
    }),
    [
      searchQuery,
      kindFilter,
      personnelFilterId,
      eventModalOpen,
      editingItem,
      createDraft,
      openCreateEvent,
      openEditEvent,
      closeEventModal,
    ],
  )

  return <CalendarShellContext.Provider value={value}>{children}</CalendarShellContext.Provider>
}

export function useCalendarShell() {
  const context = useContext(CalendarShellContext)
  if (!context) {
    throw new Error('useCalendarShell must be used within CalendarShellProvider')
  }
  return context
}

export function filterCalendarItems(
  items: CalendarItem[],
  personnel: Array<{ id: string; fullName: string }>,
  filters: {
    searchQuery: string
    kindFilter: CalendarKindFilter
    personnelFilterId: string | null
    showTasks?: boolean
  },
): CalendarItem[] {
  const query = filters.searchQuery.trim().toLowerCase()
  const showTasks = filters.showTasks ?? true

  return items.filter((item) => {
    if (!showTasks && item.kind === 'task') {
      return false
    }

    if (filters.kindFilter !== 'all' && item.kind !== filters.kindFilter) {
      return false
    }

    if (filters.personnelFilterId && !item.assignedPersonnelIds.includes(filters.personnelFilterId)) {
      return false
    }

    if (!query) return true

    if (item.title.toLowerCase().includes(query)) return true
    if (item.description?.toLowerCase().includes(query)) return true
    if (item.noteCategory?.toLowerCase().includes(query)) return true

    return item.assignedPersonnelIds.some((personId) => {
      const person = personnel.find((entry) => entry.id === personId)
      return person?.fullName.toLowerCase().includes(query)
    })
  })
}
