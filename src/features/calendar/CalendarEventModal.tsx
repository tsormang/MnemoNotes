import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { AlertTriangle, CalendarClock, FileText, ListTodo, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  FormToggle,
  ToggleOption,
  ToggleSegmentGroup,
  ToggleSegmentOption,
} from '../../components/FormToggle'
import { FieldLabel } from '../../components/FieldLabel'
import { Modal } from '../../components/Modal'
import { DatetimeInput } from '../../components/DatetimeInput'
import { NotificationOffsetPicker } from '../../components/NotificationOffsetPicker'
import { IconAvatar } from '../../components/icons/IconAvatar'
import { IconPicker, syncNoteIconForCollection } from '../../components/icons/IconPicker'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { findShiftConflicts } from '../../lib/calendar-conflicts'
import { defaultEventEnd, normalizeEventRange, noteEventEnd, snapIsoToTimeStep, splitIsoDatetime } from '../../lib/calendar-datetime'
import { inferTimeStepMinutes, type TimeStepMinutes } from '../../lib/calendar-hours'
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
import { defaultIconIdForKind, defaultNoteIconId } from '../../lib/icons/defaults'
import type { NoteIconCollection } from '../../lib/icons/types'
import { useIconCatalog } from '../../lib/queries/icons'
import { visibleCalendarKinds } from '../../lib/display-preferences'
import { useDisplayPreferences } from '../../store/display-preferences'
import { useCalendarShell, type CalendarEventDraft } from './CalendarShellContext'

const kindOptions: CalendarItemKind[] = ['shift', 'note', 'task']

const kindSegmentIcons: Record<CalendarItemKind, typeof CalendarClock> = {
  shift: CalendarClock,
  note: FileText,
  task: ListTodo,
}

const priorityOptions = ['low', 'normal', 'high', 'critical'] as const

function buildDefaults(
  item: CalendarItem | null,
  draft: CalendarEventDraft | null,
  defaultLocationId: string,
  defaultKind: CalendarItemKind,
  orgNotificationDefaults = ORG_NOTIFICATION_DEFAULTS,
  timeStepMinutes: TimeStepMinutes = 60,
): CalendarItemInput {
  if (item) {
    const snapped = normalizeEventRange(item.startsAt, item.endsAt, timeStepMinutes)
    const endsAt =
      item.kind === 'note' ? noteEventEnd(snapped.startsAt) : snapped.endsAt
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
      endsAt,
      locationId: item.locationId || defaultLocationId,
      assignedPersonnelIds: item.assignedPersonnelIds,
      priority: item.priority,
      iconId: item.iconId ?? defaultIconIdForKind(item.kind),
      requiresAcknowledgement: item.requiresAcknowledgement,
      notificationOffsets: item.notificationOffsets,
      useCustomNotificationOffsets: !offsetsEqual(item.notificationOffsets, orgResolved),
    }
  }

  const kind = draft?.kind ?? defaultKind
  const startsAt = draft?.startsAt ?? new Date().toISOString()
  const endsAt =
    kind === 'note'
      ? noteEventEnd(startsAt)
      : (draft?.endsAt ?? defaultEventEnd(startsAt))
  const snapped = normalizeEventRange(startsAt, endsAt, timeStepMinutes)

  return {
    title: '',
    description: '',
    kind,
    startsAt: snapped.startsAt,
    endsAt: snapped.endsAt,
    locationId: defaultLocationId,
    assignedPersonnelIds: [],
    priority: 'normal',
    iconId: defaultIconIdForKind(kind),
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
  const { t } = useTranslation(['calendar', 'common'])
  const { user } = useAuth()
  const { iconMatchesNoteCollection, byId } = useIconCatalog()
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
  const [noteIconCollection, setNoteIconCollection] = useState<NoteIconCollection>('medical')
  const [timeStepMinutes, setTimeStepMinutes] = useState<TimeStepMinutes>(60)
  const showTasks = useDisplayPreferences((state) => state.showTasks)

  const personnel = personnelQuery.data ?? []
  const defaultLocationId = companyLocation.locationId
  const defaultKind: CalendarItemKind = canCreateKind(can, 'shift')
    ? 'shift'
    : canCreateKind(can, 'note')
      ? 'note'
      : showTasks && canCreateKind(can, 'task')
        ? 'task'
        : 'shift'

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
    const sourceStartsAt = editingItem?.startsAt ?? createDraft?.startsAt
    const initialStep = sourceStartsAt
      ? inferTimeStepMinutes(splitIsoDatetime(sourceStartsAt).time)
      : 60
    setTimeStepMinutes(initialStep)
    form.reset(
      buildDefaults(
        editingItem,
        createDraft,
        defaultLocationId,
        defaultKind,
        orgNotificationDefaults,
        initialStep,
      ),
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
  const watchedPriority = form.watch('priority')
  const startsAt = form.watch('startsAt')
  const endsAt = form.watch('endsAt')
  const assignedPersonnelIds = form.watch('assignedPersonnelIds')
  const requiresAcknowledgement = form.watch('requiresAcknowledgement')
  const notificationOffsets = form.watch('notificationOffsets')
  const useCustomNotificationOffsets = form.watch('useCustomNotificationOffsets')
  const iconId = form.watch('iconId')

  useEffect(() => {
    if (watchedKind !== 'note') return
    const currentIcon = iconId ? byId.get(iconId) : undefined
    if (currentIcon?.noteIconCollection) {
      setNoteIconCollection(currentIcon.noteIconCollection)
    }
  }, [byId, iconId, watchedKind])

  useEffect(() => {
    if (watchedKind === 'shift' || editingItem) return
    form.setValue('iconId', defaultIconIdForKind(watchedKind), { shouldDirty: false })
  }, [form, watchedKind, editingItem])

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

  useEffect(() => {
    if (watchedKind !== 'note' || !startsAt) return
    const nextEnd = noteEventEnd(startsAt)
    if (endsAt === nextEnd) return
    form.setValue('endsAt', nextEnd, { shouldValidate: true, shouldDirty: false })
  }, [watchedKind, startsAt, endsAt, form])

  const handleStartsAtChange = useCallback(
    (iso: string) => {
      form.setValue('startsAt', iso, { shouldValidate: true, shouldDirty: true })
      if (form.getValues('kind') === 'note') {
        form.setValue('endsAt', noteEventEnd(iso), { shouldValidate: true, shouldDirty: false })
      }
    },
    [form],
  )

  const handleEndsAtChange = useCallback(
    (iso: string) => form.setValue('endsAt', iso, { shouldValidate: true, shouldDirty: true }),
    [form],
  )

  const handleTimeStepChange = useCallback(
    (step: 30 | 15) => {
      const nextStep: TimeStepMinutes = timeStepMinutes === step ? 60 : step
      setTimeStepMinutes(nextStep)

      const currentStart = form.getValues('startsAt')
      if (currentStart) {
        form.setValue('startsAt', snapIsoToTimeStep(currentStart, nextStep), {
          shouldValidate: true,
          shouldDirty: true,
        })
      }

      if (form.getValues('kind') !== 'note') {
        const currentEnd = form.getValues('endsAt')
        if (currentEnd) {
          form.setValue('endsAt', snapIsoToTimeStep(currentEnd, nextStep), {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      }
    },
    [form, timeStepMinutes],
  )

  const isEditing = Boolean(editingItem)
  const canSave =
    isSupabaseConfigured &&
    Boolean(defaultLocationId) &&
    (isEditing ? canUpdateKind(can, watchedKind) : canCreateKind(can, watchedKind))
  const canDelete =
    isEditing && editingItem && isSupabaseConfigured && canDeleteKind(can, editingItem.kind)
  const showAssignments = watchedKind === 'shift' && canAssignShifts(can)
  const showEndTime = watchedKind !== 'note'

  const availableKinds = visibleCalendarKinds(kindOptions, showTasks).filter((kind) =>
    isEditing ? true : canCreateKind(can, kind),
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
    return t('calendar:eventModal.conflictLine', {
      name: person?.fullName ?? t('calendar:eventModal.staffFallback'),
      event: conflictLabel,
    })
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    const payload =
      values.kind === 'note'
        ? { ...values, endsAt: noteEventEnd(values.startsAt) }
        : values
    try {
      await upsertItem.mutateAsync({
        ...payload,
        locationId: defaultLocationId,
        id: editingItem?.id,
        seriesId: editingItem?.seriesId,
        timezone: orgQuery.data?.timezone,
        orgNotificationDefaults,
      })
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('calendar:eventModal.errorSave'),
      )
    }
  })

  const handleDelete = async () => {
    if (!editingItem || !canDelete) return
    setSubmitError(null)
    try {
      await deleteItem.mutateAsync(editingItem.id)
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('calendar:eventModal.errorDelete'),
      )
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
      <div className="create-event-form__row">
        <div className="create-event-form__segment-field">
          <FieldLabel>{t('common:field.type')}</FieldLabel>
          <ToggleSegmentGroup aria-label={t('common:field.type')}>
            {availableKinds.map((kind) => {
              const Icon = kindSegmentIcons[kind]
              return (
                <ToggleSegmentOption
                  key={kind}
                  pressed={watchedKind === kind}
                  disabled={isEditing || availableKinds.length === 0}
                  icon={<Icon size={15} strokeWidth={2.25} aria-hidden="true" />}
                  onClick={() => form.setValue('kind', kind, { shouldValidate: true, shouldDirty: true })}
                >
                  {t(`common:eventKind.${kind}`)}
                </ToggleSegmentOption>
              )
            })}
          </ToggleSegmentGroup>
          <input type="hidden" {...form.register('kind')} />
        </div>

        <div className="create-event-form__segment-field">
          <FieldLabel>{t('common:field.priority')}</FieldLabel>
          <ToggleSegmentGroup aria-label={t('common:field.priority')}>
            {priorityOptions.map((priority) => (
              <ToggleSegmentOption
                key={priority}
                pressed={watchedPriority === priority}
                disabled={!canSave}
                onClick={() =>
                  form.setValue('priority', priority, { shouldValidate: true, shouldDirty: true })
                }
              >
                {t(`common:priority.${priority}`)}
              </ToggleSegmentOption>
            ))}
          </ToggleSegmentGroup>
          <input type="hidden" {...form.register('priority')} />
        </div>
      </div>

      {watchedKind !== 'shift' ? (
        <label>
          <FieldLabel required>{t('common:field.title')}</FieldLabel>
          <input
            type="text"
            placeholder={t('calendar:eventModal.titlePlaceholder')}
            {...form.register('title')}
          />
          {form.formState.errors.title ? (
            <span className="form-error">{form.formState.errors.title.message}</span>
          ) : null}
        </label>
      ) : null}

      {watchedKind === 'note' ? (
        <label>
          <FieldLabel>{t('common:field.description')}</FieldLabel>
          <textarea
            rows={2}
            placeholder={t('calendar:eventModal.descriptionPlaceholder')}
            {...form.register('description')}
          />
          {form.formState.errors.description ? (
            <span className="form-error">{form.formState.errors.description.message}</span>
          ) : null}
        </label>
      ) : null}

      <input type="hidden" {...form.register('locationId')} />

      <div className={clsx('create-event-form__row', !showEndTime && 'create-event-form__row--single')}>
        <label>
          <FieldLabel required>{t('calendar:eventModal.starts')}</FieldLabel>
          <DatetimeInput
            value={startsAt}
            dateLabel={t('calendar:eventModal.startDate')}
            timeLabel={t('calendar:eventModal.startTime')}
            disabled={!canSave}
            timeStepMinutes={timeStepMinutes}
            onChange={handleStartsAtChange}
          />
        </label>

        {showEndTime ? (
          <label>
            <FieldLabel required>{t('calendar:eventModal.ends')}</FieldLabel>
            <DatetimeInput
              value={endsAt}
              dateLabel={t('calendar:eventModal.endDate')}
              timeLabel={t('calendar:eventModal.endTime')}
              disabled={!canSave}
              timeStepMinutes={timeStepMinutes}
              onChange={handleEndsAtChange}
            />
            {form.formState.errors.endsAt ? (
              <span className="form-error">{form.formState.errors.endsAt.message}</span>
            ) : null}
          </label>
        ) : null}
      </div>
      <input type="hidden" {...form.register('endsAt')} />

      <div className="create-event-form__time-steps-field">
        <FieldLabel>{t('calendar:eventModal.timeStepLabel')}</FieldLabel>
        <div
          className="create-event-form__time-steps"
          role="group"
          aria-label={t('calendar:eventModal.timeStepLabel')}
        >
          <ToggleOption
            pressed={timeStepMinutes === 30}
            disabled={!canSave}
            onClick={() => handleTimeStepChange(30)}
          >
            {t('calendar:eventModal.timeStep30')}
          </ToggleOption>
          <ToggleOption
            pressed={timeStepMinutes === 15}
            disabled={!canSave}
            onClick={() => handleTimeStepChange(15)}
          >
            {t('calendar:eventModal.timeStep15')}
          </ToggleOption>
        </div>
      </div>

      {watchedKind !== 'shift' ? (
        <>
          {watchedKind === 'note' ? (
            <IconPicker
              entityType="note"
              value={iconId ?? defaultNoteIconId(noteIconCollection)}
              noteIconCollection={noteIconCollection}
              onNoteIconCollectionChange={(collection) => {
                setNoteIconCollection(collection)
                form.setValue(
                  'iconId',
                  syncNoteIconForCollection(iconId, collection, iconMatchesNoteCollection),
                  { shouldDirty: true, shouldValidate: true },
                )
              }}
              onChange={(nextIconId) =>
                form.setValue('iconId', nextIconId, { shouldDirty: true, shouldValidate: true })
              }
              disabled={!canSave}
            />
          ) : (
            <IconPicker
              entityType="task"
              value={iconId ?? defaultIconIdForKind(watchedKind)}
              onChange={(nextIconId) =>
                form.setValue('iconId', nextIconId, { shouldDirty: true, shouldValidate: true })
              }
              disabled={!canSave}
            />
          )}
          <FormToggle
            block
            pressed={Boolean(requiresAcknowledgement)}
            disabled={!canSave}
            onClick={() =>
              form.setValue('requiresAcknowledgement', !requiresAcknowledgement, { shouldDirty: true })
            }
          >
            {t('calendar:eventModal.requiresAck')}
          </FormToggle>
        </>
      ) : null}

      {watchedKind === 'shift' ? (
        <label>
          <FieldLabel>{t('common:field.description')}</FieldLabel>
          <textarea
            rows={2}
            placeholder={t('calendar:eventModal.descriptionPlaceholder')}
            {...form.register('description')}
          />
          {form.formState.errors.description ? (
            <span className="form-error">{form.formState.errors.description.message}</span>
          ) : null}
        </label>
      ) : null}

      {showAssignments ? (
        <fieldset className="assignee-fieldset">
          <legend>{t('calendar:eventModal.assignedStaff')}</legend>
          <div className="assignee-list" role="group" aria-label={t('calendar:eventModal.assignedStaff')}>
            {personnel.map((person) => {
              const selected = assignedPersonnelIds?.includes(person.id) ?? false
              return (
                <button
                  key={person.id}
                  type="button"
                  className={clsx('assignee-option', selected && 'is-selected')}
                  aria-pressed={selected}
                  onClick={() => toggleAssignee(person.id)}
                >
                  <IconAvatar
                    iconId={person.iconId}
                    entityType="personnel"
                    label={person.fullName}
                    size="lg"
                  />
                  <span className="assignee-option__name">{person.fullName}</span>
                </button>
              )
            })}
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
            <strong>{t('calendar:eventModal.conflictTitle')}</strong>
            <ul>
              {conflictLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!defaultLocationId && !companyLocation.loading ? (
        <p className="form-error">{t('calendar:eventModal.locationUnavailable')}</p>
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
            {t('common:actions.delete')}
          </button>
        ) : null}
        <button className="icon-button" type="submit" disabled={!canSave || upsertItem.isPending}>
          {upsertItem.isPending
            ? t('common:actions.saving')
            : isEditing
              ? t('calendar:eventModal.saveChanges')
              : t('calendar:eventModal.saveEvent')}
        </button>
      </div>
    </form>
  )
}

export function CalendarEventModal() {
  const { t } = useTranslation('calendar')
  const { eventModalOpen, editingItem, createDraft, closeEventModal } = useCalendarShell()

  if (!eventModalOpen) return null

  const modalKey = editingItem?.id ?? createDraft?.startsAt ?? 'create'

  return (
    <Modal
      open
      onClose={closeEventModal}
      title={editingItem ? t('eventModal.editTitle') : t('eventModal.createTitle')}
      wide
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
