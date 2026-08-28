import { zodResolver } from '@hookform/resolvers/zod'
import { Clock3, Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { formatClockLabel } from '../../lib/calendar-hours'
import { useOrganization } from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { workingDaySchema, type WorkingDayInput } from '../../lib/validation'

interface WorkingDaySettingsProps {
  /** Compact layout for embedded modals. */
  compact?: boolean
  organizationId?: string | null
}

export function WorkingDaySettings({ compact = false, organizationId: orgIdProp }: WorkingDaySettingsProps) {
  const { organizationId: workspaceOrgId, can } = useWorkspace()
  const organizationId = orgIdProp ?? workspaceOrgId
  const orgQuery = useOrganization(organizationId)
  const queryClient = useQueryClient()

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
        throw new Error('Organization is not available.')
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
        message: error instanceof Error ? error.message : 'Could not save working hours.',
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
          <h2>Working day duration</h2>
          <p>
            Calendar day and week views show{' '}
            <strong>
              {formatClockLabel(workingDayStart)} – {formatClockLabel(workingDayEnd)}
            </strong>{' '}
            by default. Owners and admins can change this window; any week can still opt into
            00:00–24:00 for night shifts.
          </p>
        </div>
      </div>

      <form className="working-day-form" onSubmit={onSubmit}>
        <label>
          From
          <input type="time" step={60} {...form.register('start')} disabled={!canEdit || !isSupabaseConfigured} />
          {form.formState.errors.start ? (
            <span className="field-error">{form.formState.errors.start.message}</span>
          ) : null}
        </label>
        <label>
          To
          <input type="time" step={60} {...form.register('end')} disabled={!canEdit || !isSupabaseConfigured} />
          {form.formState.errors.end ? (
            <span className="field-error">{form.formState.errors.end.message}</span>
          ) : null}
        </label>
        {canEdit ? (
          <button className="icon-button" type="submit" disabled={saveMutation.isPending}>
            <Save size={16} aria-hidden="true" />
            {saveMutation.isPending ? 'Saving…' : 'Save hours'}
          </button>
        ) : null}
      </form>
    </section>
  )
}
