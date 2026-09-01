import { zodResolver } from '@hookform/resolvers/zod'
import { Clock3, Save } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TimeInput } from '../../components/TimeInput'
import { FieldLabel } from '../../components/FieldLabel'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { formatClockLabel } from '../../lib/calendar-hours'
import { useOrganization } from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { createWorkingDaySchema, type WorkingDayInput } from '../../lib/validation'

interface WorkingDaySettingsProps {
  /** Compact layout for embedded modals. */
  compact?: boolean
  organizationId?: string | null
}

export function WorkingDaySettings({ compact = false, organizationId: orgIdProp }: WorkingDaySettingsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { t: tv } = useTranslation('validation')
  const { organizationId: workspaceOrgId, can } = useWorkspace()
  const organizationId = orgIdProp ?? workspaceOrgId
  const orgQuery = useOrganization(organizationId)
  const queryClient = useQueryClient()
  const workingDaySchema = useMemo(() => createWorkingDaySchema(tv), [tv])

  const workingDayStart = orgQuery.data?.workingDayStart ?? '07:00'
  const workingDayEnd = orgQuery.data?.workingDayEnd ?? '21:00'
  const canEdit = can('organization.update')

  const form = useForm<WorkingDayInput>({
    resolver: zodResolver(workingDaySchema),
    defaultValues: {
      start: workingDayStart,
      end: workingDayEnd,
    },
  })

  useEffect(() => {
    form.reset({ start: workingDayStart, end: workingDayEnd })
  }, [form, workingDayStart, workingDayEnd])

  const saveMutation = useMutation({
    mutationFn: async (values: WorkingDayInput) => {
      if (!organizationId || !supabase) {
        throw new Error(t('common:errors.organizationUnavailable'))
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          working_day_start: `${values.start}:00`,
          working_day_end: `${values.end}:00`,
        })
        .eq('id', organizationId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', organizationId] })
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveMutation.mutateAsync(values)
    } catch (error) {
      form.setError('end', {
        message: error instanceof Error ? error.message : t('settings:workingDay.errorSave'),
      })
    }
  })

  return (
    <section className={`working-day-settings${compact ? ' working-day-settings--compact' : ''}`}>
      <div className="working-day-settings__heading">
        <div className="working-day-settings__icon" aria-hidden="true">
          <Clock3 size={18} />
        </div>
        <div>
          <h2>{t('settings:workingDay.title')}</h2>
          <p>
            <Trans
              i18nKey="workingDay.description"
              ns="settings"
              values={{
                start: formatClockLabel(workingDayStart),
                end: formatClockLabel(workingDayEnd),
              }}
              components={{ 1: <strong /> }}
            />
          </p>
        </div>
      </div>

      <form className="working-day-form" onSubmit={onSubmit}>
        <label>
          <FieldLabel required>{t('common:field.from')}</FieldLabel>
          <TimeInput
            value={form.watch('start')}
            disabled={!canEdit || !isSupabaseConfigured}
            aria-label={t('settings:workingDay.startAria')}
            onChange={(value) => form.setValue('start', value, { shouldValidate: true })}
          />
          {form.formState.errors.start ? (
            <span className="field-error">{form.formState.errors.start.message}</span>
          ) : null}
        </label>
        <label>
          <FieldLabel required>{t('common:field.to')}</FieldLabel>
          <TimeInput
            value={form.watch('end')}
            disabled={!canEdit || !isSupabaseConfigured}
            aria-label={t('settings:workingDay.endAria')}
            onChange={(value) => form.setValue('end', value, { shouldValidate: true })}
          />
          {form.formState.errors.end ? (
            <span className="field-error">{form.formState.errors.end.message}</span>
          ) : null}
        </label>
        {canEdit ? (
          <button className="icon-button" type="submit" disabled={saveMutation.isPending}>
            <Save size={16} aria-hidden="true" />
            {saveMutation.isPending ? t('common:actions.saving') : t('settings:workingDay.save')}
          </button>
        ) : null}
      </form>
    </section>
  )
}
