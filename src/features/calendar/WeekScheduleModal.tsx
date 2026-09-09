import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FieldLabel } from '../../components/FieldLabel'
import { Modal } from '../../components/Modal'
import { ToggleOption } from '../../components/FormToggle'
import { TimeInput } from '../../components/TimeInput'
import { PersonnelSelectButton } from '../../components/PersonnelSelectButton'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { getCalendarItemDisplayLabel } from '../../lib/calendar-display'
import { findShiftConflicts } from '../../lib/calendar-conflicts'
import { canAssignShifts, canCreateKind } from '../../lib/calendar-permissions'
import {
  buildEmptyWeekDays,
  listWeekShiftRanges,
  snapOptionalClockTime,
} from '../../lib/calendar-week-schedule'
import { getWeekStartKey, type TimeStepMinutes } from '../../lib/calendar-hours'
import { useUpsertCalendarItem } from '../../lib/queries/mutations'
import {
  useCalendarItems,
  useCompanyLocation,
  useOrganization,
  usePersonnelList,
} from '../../lib/queries/workspace'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  ORG_NOTIFICATION_DEFAULTS,
  resolveNotificationOffsets,
} from '../../lib/notification-schedule'
import { weekScheduleSchema, type WeekScheduleInput } from '../../lib/validation'
import { useCalendarShell } from './CalendarShellContext'

function dayLabel(date: string): string {
  return format(parseISO(`${date}T12:00:00`), 'EEE d MMM')
}

export function WeekScheduleModal({
  open,
  weekStart,
  onClose,
}: {
  open: boolean
  weekStart: Date
  onClose: () => void
}) {
  const { t } = useTranslation(['calendar', 'common'])
  const { user } = useAuth()
  const { organizationId, membership, can } = useWorkspace()
  const { personnelFilterId } = useCalendarShell()
  const orgQuery = useOrganization(organizationId)
  const companyLocation = useCompanyLocation(organizationId, {
    fallbackCompanyName: membership?.organizationName,
  })
  const personnelQuery = usePersonnelList(organizationId)
  const calendarQuery = useCalendarItems(organizationId)
  const upsertItem = useUpsertCalendarItem(organizationId, user?.id ?? null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [timeStepMinutes, setTimeStepMinutes] = useState<TimeStepMinutes>(60)

  const personnel = personnelQuery.data ?? []
  const defaultLocationId = companyLocation.locationId
  const orgNotificationDefaults = orgQuery.data?.notificationDefaults ?? ORG_NOTIFICATION_DEFAULTS
  const canSave =
    isSupabaseConfigured &&
    Boolean(defaultLocationId) &&
    canCreateKind(can, 'shift') &&
    canAssignShifts(can)

  const weekStartKey = getWeekStartKey(weekStart)

  const form = useForm<WeekScheduleInput>({
    resolver: zodResolver(weekScheduleSchema),
    defaultValues: {
      assignedPersonnelId: '',
      overnight: false,
      days: buildEmptyWeekDays(weekStart),
    },
  })

  useEffect(() => {
    if (!open) return
    setTimeStepMinutes(60)
    setSubmitError(null)
    form.reset({
      assignedPersonnelId: '',
      overnight: false,
      days: buildEmptyWeekDays(parseISO(`${weekStartKey}T12:00:00`)),
    })
  }, [form, open, weekStartKey])

  useEffect(() => {
    if (!open || form.getValues('assignedPersonnelId')) return
    if (personnelFilterId && personnel.some((person) => person.id === personnelFilterId)) {
      form.setValue('assignedPersonnelId', personnelFilterId)
    }
  }, [form, open, personnel, personnelFilterId])

  const assignedPersonnelId = form.watch('assignedPersonnelId')
  const overnight = form.watch('overnight')
  const days = form.watch('days')

  const handleTimeStepChange = useCallback(
    (step: 30 | 15) => {
      const nextStep: TimeStepMinutes = timeStepMinutes === step ? 60 : step
      setTimeStepMinutes(nextStep)
      const currentDays = form.getValues('days')
      form.setValue(
        'days',
        currentDays.map((day) => ({
          ...day,
          startTime: snapOptionalClockTime(day.startTime, nextStep),
          endTime: snapOptionalClockTime(day.endTime, nextStep),
        })),
        { shouldValidate: true, shouldDirty: true },
      )
    },
    [form, timeStepMinutes],
  )

  const draftRanges = useMemo(
    () => listWeekShiftRanges(days ?? [], overnight),
    [days, overnight],
  )

  const conflicts = useMemo(() => {
    if (!assignedPersonnelId) return []
    const items = calendarQuery.data ?? []
    const labels: string[] = []

    const person = personnel.find((entry) => entry.id === assignedPersonnelId)
    const personName = person?.fullName ?? t('calendar:eventModal.staffFallback')

    draftRanges.forEach((range, index) => {
      const found = findShiftConflicts(items, {
        id: `week-draft-${index}`,
        kind: 'shift',
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        assignedPersonnelIds: [assignedPersonnelId],
      })
      for (const conflict of found) {
        const conflictingItem = items.find((item) => item.id === conflict.conflictingItemId)
        const conflictLabel = conflictingItem
          ? getCalendarItemDisplayLabel(conflictingItem, personnel)
          : conflict.conflictingTitle
        labels.push(
          t('calendar:eventModal.conflictLine', {
            name: personName,
            event: conflictLabel,
          }),
        )
      }

      for (let otherIndex = index + 1; otherIndex < draftRanges.length; otherIndex += 1) {
        const other = draftRanges[otherIndex]
        if (!other) continue
        const start = new Date(range.startsAt).getTime()
        const end = new Date(range.endsAt).getTime()
        const otherStart = new Date(other.startsAt).getTime()
        const otherEnd = new Date(other.endsAt).getTime()
        if (start < otherEnd && end > otherStart) {
          labels.push(
            t('calendar:eventModal.conflictLine', {
              name: personName,
              event: dayLabel(other.date),
            }),
          )
        }
      }
    })

    return [...new Set(labels)]
  }, [assignedPersonnelId, calendarQuery.data, draftRanges, personnel, t])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!defaultLocationId) return
    setSubmitError(null)
    const ranges = listWeekShiftRanges(values.days, values.overnight)
    const notificationOffsets = resolveNotificationOffsets({
      kind: 'shift',
      requiresAcknowledgement: false,
      orgDefaults: orgNotificationDefaults,
    })

    try {
      for (const range of ranges) {
        await upsertItem.mutateAsync({
          title: '',
          description: '',
          kind: 'shift',
          allDay: false,
          startsAt: range.startsAt,
          endsAt: range.endsAt,
          locationId: defaultLocationId,
          assignedPersonnelIds: [values.assignedPersonnelId],
          requiresAcknowledgement: false,
          notificationOffsets,
          useCustomNotificationOffsets: false,
          timezone: orgQuery.data?.timezone,
          orgNotificationDefaults,
        })
      }
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('calendar:eventModal.errorSave'),
      )
    }
  })

  if (!open) return null

  const daysError =
    typeof form.formState.errors.days?.message === 'string'
      ? form.formState.errors.days.message
      : null

  return (
    <Modal open onClose={onClose} title={t('calendar:weekSchedule.title')} wide>
      <form className="create-event-form week-schedule-form" onSubmit={onSubmit}>
        <fieldset className="assignee-fieldset">
          <legend>
            <FieldLabel required>{t('calendar:eventModal.assignedStaff')}</FieldLabel>
          </legend>
          {personnel.length === 0 ? (
            <p className="modal-hint">{t('calendar:weekSchedule.noStaff')}</p>
          ) : (
            <div className="assignee-list" role="radiogroup" aria-label={t('calendar:eventModal.assignedStaff')}>
              {personnel.map((person) => {
                const selected = assignedPersonnelId === person.id
                return (
                  <PersonnelSelectButton
                    key={person.id}
                    person={person}
                    selected={selected}
                    role="radio"
                    aria-checked={selected}
                    disabled={!canSave}
                    onClick={() =>
                      form.setValue('assignedPersonnelId', person.id, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )
              })}
            </div>
          )}
          {form.formState.errors.assignedPersonnelId ? (
            <span className="form-error">{form.formState.errors.assignedPersonnelId.message}</span>
          ) : null}
        </fieldset>

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
            <ToggleOption
              className="toggle-option--overnight"
              pressed={overnight}
              disabled={!canSave}
              onClick={() =>
                form.setValue('overnight', !overnight, { shouldValidate: true, shouldDirty: true })
              }
            >
              {t('calendar:eventModal.overnight')}
            </ToggleOption>
          </div>
        </div>

        <div className="week-schedule-days">
          <div className="week-schedule-days__header">
            <span />
            <span>{t('calendar:weekSchedule.start')}</span>
            <span>{t('calendar:weekSchedule.end')}</span>
          </div>
          {(days ?? []).map((day, index) => {
            const startError = form.formState.errors.days?.[index]?.startTime?.message
            const endError = form.formState.errors.days?.[index]?.endTime?.message
            return (
              <div key={day.date} className="week-schedule-day">
                <span className="week-schedule-day__label">{dayLabel(day.date)}</span>
                <TimeInput
                  allowEmpty
                  emptyLabel={t('calendar:weekSchedule.emptyTime')}
                  value={day.startTime}
                  disabled={!canSave}
                  stepMinutes={timeStepMinutes}
                  aria-label={t('calendar:weekSchedule.startForDay', { day: dayLabel(day.date) })}
                  onChange={(time) =>
                    form.setValue(`days.${index}.startTime`, time, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
                <TimeInput
                  allowEmpty
                  emptyLabel={t('calendar:weekSchedule.emptyTime')}
                  value={day.endTime}
                  disabled={!canSave}
                  stepMinutes={timeStepMinutes}
                  aria-label={t('calendar:weekSchedule.endForDay', { day: dayLabel(day.date) })}
                  onChange={(time) =>
                    form.setValue(`days.${index}.endTime`, time, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
                {startError || endError ? (
                  <span className="form-error week-schedule-day__error">{startError ?? endError}</span>
                ) : null}
              </div>
            )
          })}
        </div>

        {daysError ? <p className="form-error">{daysError}</p> : null}

        {conflicts.length > 0 ? (
          <div className="conflict-banner" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>{t('calendar:eventModal.conflictTitle')}</strong>
              <ul>
                {conflicts.map((label) => (
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

        <p className="modal-hint">{t('calendar:reminders.useDefaults')}</p>

        <div className="form-actions">
          <button className="icon-button" type="submit" disabled={!canSave || upsertItem.isPending}>
            {upsertItem.isPending
              ? t('common:actions.saving')
              : t('calendar:weekSchedule.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
