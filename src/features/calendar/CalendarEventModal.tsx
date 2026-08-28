import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from '../../components/Modal'
import { CompanyLocationField } from '../../components/CompanyLocationField'
import { DatetimeInput } from '../../components/DatetimeInput'
import { NotificationOffsetPicker } from '../../components/NotificationOffsetPicker'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { findShiftConflicts } from '../../lib/calendar-conflicts'
import { defaultEventEnd, normalizeEventRange } from '../../lib/calendar-datetime'
import {
  canAssignShifts,
  canCreateKind,
  canDeleteKind,
  canUpdateKind,
} from '../../lib/calendar-permissions'
import {
  useDeleteCalendarItem,
  useUpsertCalendarItem,
} from '../../lib/queries/mutations'
import {
  useCalendarItems,
  useCompanyLocation,
  useOrganization,
  usePersonnelList,
} from '../../lib/queries/workspace'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  offsetsEqual,
  ORG_NOTIFICATION_DEFAULTS,
  resolveNotificationOffsets,
} from '../../lib/notification-schedule'
import type { CalendarItem, CalendarItemKind } from '../../types/domain'
import { calendarItemSchema, type CalendarItemInput } from '../../lib/validation'
import { useCalendarShell, type CalendarEventDraft } from './CalendarShellContext'

const kindOptions: Array<{ value: CalendarItemKind; label: string }> = [
  { value: 'shift', label: 'Shift' },
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
]

function buildDefaults(
  item: CalendarItem | null,
  draft: CalendarEventDraft | null,
  defaultLocationId: string,
  defaultKind: CalendarItemKind,
  orgNotificationDefaults = ORG_NOTIFICATION_DEFAULTS,
): CalendarItemInput {
  if (item) {
    const snapped = normalizeEventRange(item.startsAt, item.endsAt)
    const orgResolved = resolveNotificationOffsets({
      kind: item.kind,
      requiresAcknowledgement: item.requiresAcknowledgement,
      orgDefaults: orgNotificationDefaults,
    })
    return {
      title: item.title,
      description: item.description ?? '',
      kind: item.kind,
      startsAt: snapped.startsAt,
      endsAt: snapped.endsAt,
      locationId: item.locationId || defaultLocationId,
      assignedPersonnelIds: item.assignedPersonnelIds,
      priority: item.priority,
      noteCategory: item.noteCategory ?? '',
      requiresAcknowledgement: item.requiresAcknowledgement,
      notificationOffsets: item.notificationOffsets,
      useCustomNotificationOffsets: !offsetsEqual(item.notificationOffsets, orgResolved),
    }
  }

  const kind = draft?.kind ?? defaultKind
  const startsAt = draft?.startsAt ?? new Date().toISOString()
  const endsAt = draft?.endsAt ?? defaultEventEnd(startsAt)
  const snapped = normalizeEventRange(startsAt, endsAt)

  return {
    title: '',
    description: '',
    kind,
    startsAt: snapped.startsAt,
    endsAt: snapped.endsAt,
    locationId: defaultLocationId,
    assignedPersonnelIds: [],
    priority: 'normal',
    noteCategory: '',
    requiresAcknowledgement: false,
    notificationOffsets: resolveNotificationOffsets({
      kind,
      requiresAcknowledgement: false,
      orgDefaults: orgNotificationDefaults,
    }),
    useCustomNotificationOffsets: false,
  }
}

function CalendarEventModalContent({
  editingItem,
  createDraft,
  onClose,
}: {
  editingItem: CalendarItem | null
  createDraft: CalendarEventDraft | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const { organizationId, membership, can } = useWorkspace()
  const orgQuery = useOrganization(organizationId)
  const companyLocation = useCompanyLocation(organizationId, {
    fallbackCompanyName: membership?.organizationName,
  })
  const personnelQuery = usePersonnelList(organizationId)
  const calendarQuery = useCalendarItems(organizationId)
  const upsertItem = useUpsertCalendarItem(organizationId, user?.id ?? null)
  const deleteItem = useDeleteCalendarItem(organizationId)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const personnel = personnelQuery.data ?? []
  const defaultLocationId = companyLocation.locationId
  const defaultKind: CalendarItemKind = canCreateKind(can, 'shift')
    ? 'shift'
    : canCreateKind(can, 'note')
      ? 'note'
      : 'task'

  const orgNotificationDefaults = orgQuery.data?.notificationDefaults ?? ORG_NOTIFICATION_DEFAULTS
  const canManageNotifications = can('organization.update') || can('notifications.manage')

  const form = useForm<CalendarItemInput>({
    resolver: zodResolver(calendarItemSchema),
    defaultValues: buildDefaults(
      editingItem,
      createDraft,
      defaultLocationId,
      defaultKind,
      orgNotificationDefaults,
    ),
  })

  useEffect(() => {
    form.reset(
      buildDefaults(editingItem, createDraft, defaultLocationId, defaultKind, orgNotificationDefaults),
    )
  }, [
    createDraft,
    defaultKind,
    defaultLocationId,
    editingItem,
    form,
    orgNotificationDefaults,
  ])

  useEffect(() => {
    if (defaultLocationId) {
      form.setValue('locationId', defaultLocationId)
    }
  }, [defaultLocationId, form])

  const watchedKind = form.watch('kind')
  const startsAt = form.watch('startsAt')
  const endsAt = form.watch('endsAt')
  const assignedPersonnelIds = form.watch('assignedPersonnelIds')
  const requiresAcknowledgement = form.watch('requiresAcknowledgement')
  const notificationOffsets = form.watch('notificationOffsets')
  const useCustomNotificationOffsets = form.watch('useCustomNotificationOffsets')

  useEffect(() => {
    if (useCustomNotificationOffsets) return
    form.setValue(
      'notificationOffsets',
      resolveNotificationOffsets({
        kind: watchedKind,
        requiresAcknowledgement,
        orgDefaults: orgNotificationDefaults,
      }),
      { shouldDirty: true },
    )
  }, [
    form,
    orgNotificationDefaults,
    requiresAcknowledgement,
    useCustomNotificationOffsets,
    watchedKind,
  ])

  const handleStartsAtChange = useCallback(
    (iso: string) => form.setValue('startsAt', iso, { shouldValidate: true, shouldDirty: true }),
    [form],
  )

  const handleEndsAtChange = useCallback(
    (iso: string) => form.setValue('endsAt', iso, { shouldValidate: true, shouldDirty: true }),
    [form],
  )

  const isEditing = Boolean(editingItem)
  const canSave =
    isSupabaseConfigured &&
    Boolean(defaultLocationId) &&
    (isEditing ? canUpdateKind(can, watchedKind) : canCreateKind(can, watchedKind))
  const canDelete =
    isEditing && editingItem && isSupabaseConfigured && canDeleteKind(can, editingItem.kind)
  const showAssignments = watchedKind === 'shift' && canAssignShifts(can)
  const showDescription = watchedKind === 'shift' || watchedKind === 'note'

  const availableKinds = kindOptions.filter((option) =>
    isEditing ? true : canCreateKind(can, option.value),
  )

  const conflicts = useMemo(() => {
    if (watchedKind !== 'shift' || !startsAt || !endsAt) return []
    return findShiftConflicts(calendarQuery.data ?? [], {
      id: editingItem?.id ?? 'new',
      kind: watchedKind,
      startsAt,
      endsAt,
      assignedPersonnelIds: assignedPersonnelIds ?? [],
    })
  }, [calendarQuery.data, editingItem?.id, watchedKind, startsAt, endsAt, assignedPersonnelIds])

  const conflictLabels = conflicts.map((conflict) => {
    const person = personnel.find((entry) => entry.id === conflict.personnelId)
    const conflictingItem = (calendarQuery.data ?? []).find((item) => item.id === conflict.conflictingItemId)
    const conflictLabel = conflictingItem
      ? getCalendarItemDisplayLabel(conflictingItem, personnel)
      : conflict.conflictingTitle
    return `${person?.fullName ?? 'Staff'} overlaps with “${conflictLabel}”`
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await upsertItem.mutateAsync({
        ...values,
        locationId: defaultLocationId,
        id: editingItem?.id,
        seriesId: editingItem?.seriesId,
        timezone: orgQuery.data?.timezone,
        orgNotificationDefaults,
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save event.')
    }
  })

  const handleDelete = async () => {
    if (!editingItem || !canDelete) return
    setSubmitError(null)
    try {
      await deleteItem.mutateAsync(editingItem.id)
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not delete event.')
    }
  }

  const toggleAssignee = (personId: string) => {
    const current = form.getValues('assignedPersonnelIds')
    if (current.includes(personId)) {
      form.setValue(
        'assignedPersonnelIds',
        current.filter((id) => id !== personId),
        { shouldValidate: true },
      )
      return
    }
    form.setValue('assignedPersonnelIds', [...current, personId], { shouldValidate: true })
  }

  return (
    <form className="create-event-form" onSubmit={onSubmit}>
      <label>
        Type
        <select {...form.register('kind')} disabled={isEditing || availableKinds.length === 0}>
          {availableKinds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {watchedKind !== 'shift' ? (
        <label>
          Title
          <input type="text" placeholder="Stock note, closing checklist…" {...form.register('title')} />
          {form.formState.errors.title ? (
            <span className="form-error">{form.formState.errors.title.message}</span>
          ) : null}
        </label>
      ) : null}

      <CompanyLocationField
        companyName={companyLocation.companyName}
        loading={companyLocation.companyNameLoading}
      />
      <input type="hidden" {...form.register('locationId')} />

      <label>
        Starts
        <DatetimeInput
          value={startsAt}
          dateLabel="Start date"
          timeLabel="Start time"
          disabled={!canSave}
          onChange={handleStartsAtChange}
        />
      </label>

      <label>
        Ends
        <DatetimeInput
          value={endsAt}
          dateLabel="End date"
          timeLabel="End time"
          disabled={!canSave}
          onChange={handleEndsAtChange}
        />
        {form.formState.errors.endsAt ? (
          <span className="form-error">{form.formState.errors.endsAt.message}</span>
        ) : null}
      </label>

      <label>
        Priority
        <select {...form.register('priority')}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>

      {watchedKind !== 'shift' ? (
        <>
          <label>
            Category
            <input type="text" placeholder="Stock, handover…" {...form.register('noteCategory')} />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" {...form.register('requiresAcknowledgement')} />
            Requires acknowledgement
          </label>
        </>
      ) : null}

      {showDescription ? (
        <label>
          Description
          <textarea
            rows={3}
            placeholder="Optional details shown when the event is opened…"
            {...form.register('description')}
          />
          {form.formState.errors.description ? (
            <span className="form-error">{form.formState.errors.description.message}</span>
          ) : null}
        </label>
      ) : null}

      {showAssignments ? (
        <fieldset className="assignee-fieldset">
          <legend>Assigned staff</legend>
          <div className="assignee-list">
            {personnel.map((person) => (
              <label key={person.id} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={assignedPersonnelIds?.includes(person.id) ?? false}
                  onChange={() => toggleAssignee(person.id)}
                />
                {person.fullName}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {canManageNotifications ? (
        <NotificationOffsetPicker
          offsets={notificationOffsets ?? []}
          useCustom={useCustomNotificationOffsets ?? false}
          disabled={!canSave}
          onOffsetsChange={(offsets) =>
            form.setValue('notificationOffsets', offsets, { shouldDirty: true })
          }
          onUseCustomChange={(value) =>
            form.setValue('useCustomNotificationOffsets', value, { shouldDirty: true })
          }
        />
      ) : null}

      {conflictLabels.length > 0 ? (
        <div className="conflict-banner" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Scheduling conflict</strong>
            <ul>
              {conflictLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!defaultLocationId && !companyLocation.loading ? (
        <p className="form-error">Company location is not available yet. Try again in a moment.</p>
      ) : null}

      {submitError ? <p className="form-error">{submitError}</p> : null}

      <div className="form-actions">
        {canDelete ? (
          <button
            className="icon-button icon-button--danger"
            type="button"
            onClick={handleDelete}
            disabled={deleteItem.isPending}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </button>
        ) : null}
        <button className="icon-button" type="submit" disabled={!canSave || upsertItem.isPending}>
          {upsertItem.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Save event'}
        </button>
      </div>
    </form>
  )
}

export function CalendarEventModal() {
  const { eventModalOpen, editingItem, createDraft, closeEventModal } = useCalendarShell()

  if (!eventModalOpen) return null

  const modalKey = editingItem?.id ?? createDraft?.startsAt ?? 'create'

  return (
    <Modal
      open
      onClose={closeEventModal}
      title={editingItem ? 'Edit event' : 'Create event'}
    >
      <CalendarEventModalContent
        key={modalKey}
        editingItem={editingItem}
        createDraft={createDraft}
        onClose={closeEventModal}
      />
    </Modal>
  )
}
