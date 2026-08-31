import { Bell, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '../auth/WorkspaceProvider'
import {
  formatOffsetLabel,
  normalizeNotificationOffsets,
  NOTIFICATION_OFFSET_PRESETS,
  ORG_NOTIFICATION_DEFAULTS,
  parseNotificationDefaults,
} from '../../lib/notification-schedule'
import { useOrganization } from '../../lib/queries/workspace'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { NotificationDefaults } from '../../types/domain'

interface NotificationDefaultsSettingsProps {
  compact?: boolean
  organizationId?: string | null
}

type DefaultsKey = keyof NotificationDefaults

function toggleOffset(current: number[], preset: number): number[] {
  return current.includes(preset)
    ? current.filter((value) => value !== preset)
    : normalizeNotificationOffsets([...current, preset])
}

export function NotificationDefaultsSettings({
  compact = false,
  organizationId: orgIdProp,
}: NotificationDefaultsSettingsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const defaultRows = useMemo(
    (): Array<{ key: DefaultsKey; label: string; description: string }> => [
      {
        key: 'shift',
        label: t('settings:reminders.shift'),
        description: t('settings:reminders.shiftDesc'),
      },
      {
        key: 'ackRequired',
        label: t('settings:reminders.ackRequired'),
        description: t('settings:reminders.ackRequiredDesc'),
      },
      {
        key: 'note',
        label: t('settings:reminders.note'),
        description: t('settings:reminders.noteDesc'),
      },
      {
        key: 'task',
        label: t('settings:reminders.task'),
        description: t('settings:reminders.taskDesc'),
      },
    ],
    [t],
  )
  const { organizationId: workspaceOrgId, can } = useWorkspace()
  const organizationId = orgIdProp ?? workspaceOrgId
  const orgQuery = useOrganization(organizationId)
  const queryClient = useQueryClient()
  const canEdit = can('organization.update')

  const [defaults, setDefaults] = useState<NotificationDefaults>(ORG_NOTIFICATION_DEFAULTS)

  useEffect(() => {
    if (orgQuery.data?.notificationDefaults) {
      setDefaults(orgQuery.data.notificationDefaults)
    }
  }, [orgQuery.data?.notificationDefaults])

  const saveMutation = useMutation({
    mutationFn: async (values: NotificationDefaults) => {
      if (!organizationId || !supabase) {
        throw new Error(t('common:errors.organizationUnavailable'))
      }

      const currentSettings =
        typeof orgQuery.data === 'object' && orgQuery.data
          ? ((await supabase
              .from('organizations')
              .select('settings')
              .eq('id', organizationId)
              .maybeSingle()).data?.settings as Record<string, unknown> | null) ?? {}
          : {}

      const { error } = await supabase
        .from('organizations')
        .update({
          settings: {
            ...currentSettings,
            notificationDefaults: values,
          },
        })
        .eq('id', organizationId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', organizationId] })
    },
  })

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(defaults)
    } catch {
      // Mutation error surfaces via pending state; keep local edits.
    }
  }

  return (
    <section
      className={`notification-defaults-settings${compact ? ' notification-defaults-settings--compact' : ''}`}
    >
      <div className="notification-defaults-settings__heading">
        <div className="notification-defaults-settings__icon" aria-hidden="true">
          <Bell size={18} />
        </div>
        <div>
          <h2>{t('settings:reminders.title')}</h2>
          <p>{t('settings:reminders.description')}</p>
        </div>
      </div>

      <div className="notification-defaults-grid">
        {defaultRows.map((row) => (
          <div className="notification-defaults-row" key={row.key}>
            <div>
              <strong>{row.label}</strong>
              <p className="modal-hint">{row.description}</p>
            </div>
            <div className="offset-chip-row" role="group" aria-label={t('settings:reminders.groupAria', { type: row.label })}>
              {NOTIFICATION_OFFSET_PRESETS.map((preset) => {
                const selected = defaults[row.key].includes(preset)
                return (
                  <button
                    key={`${row.key}-${preset}`}
                    type="button"
                    className={`offset-chip${selected ? ' offset-chip--selected' : ''}`}
                    disabled={!canEdit || !isSupabaseConfigured}
                    aria-pressed={selected}
                    onClick={() =>
                      setDefaults((current) => ({
                        ...current,
                        [row.key]: toggleOffset(current[row.key], preset),
                      }))
                    }
                  >
                    {formatOffsetLabel(preset)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {canEdit ? (
        <button
          className="icon-button"
          type="button"
          disabled={saveMutation.isPending || !isSupabaseConfigured}
          onClick={() => void handleSave()}
        >
          <Save size={16} aria-hidden="true" />
          {saveMutation.isPending ? t('common:actions.saving') : t('settings:reminders.save')}
        </button>
      ) : null}
    </section>
  )
}

export { parseNotificationDefaults }
