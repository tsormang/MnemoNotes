import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import type { CopyConflictAnalysis } from '../../lib/calendar-copy-overwrite'

interface CopyOverwriteConfirmModalProps {
  open: boolean
  analysis: CopyConflictAnalysis
  canReplace: boolean
  isPending: boolean
  onCancel: () => void
  onIgnore: () => void
  onReplace: () => void
}

function buildConflictMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  analysis: CopyConflictAnalysis,
): string {
  const parts: string[] = []

  if (analysis.noteConflicts > 0) {
    parts.push(t('calendar:copyOverwrite.messageNotes', { count: analysis.noteConflicts }))
  }
  if (analysis.shiftConflicts > 0) {
    parts.push(t('calendar:copyOverwrite.messageShifts', { count: analysis.shiftConflicts }))
  }

  if (parts.length === 0) {
    return t('calendar:copyOverwrite.messageMixed')
  }

  return parts.join(' ')
}

export function CopyOverwriteConfirmModal({
  open,
  analysis,
  canReplace,
  isPending,
  onCancel,
  onIgnore,
  onReplace,
}: CopyOverwriteConfirmModalProps) {
  const { t } = useTranslation(['calendar', 'common'])

  return (
    <Modal open={open} onClose={onCancel} title={t('calendar:copyOverwrite.title')}>
      <p className="copy-overwrite-modal__message">{buildConflictMessage(t, analysis)}</p>
      {analysis.clearTargetCount > 0 ? (
        <p className="copy-overwrite-modal__hint">
          {t('calendar:copyOverwrite.clearTargetsHint', { count: analysis.clearTargetCount })}
        </p>
      ) : null}
      <p className="copy-overwrite-modal__hint">{t('calendar:copyOverwrite.choiceHint')}</p>
      <div className="form-actions copy-overwrite-modal__actions">
        <button type="button" className="icon-button" onClick={onCancel} disabled={isPending}>
          {t('common:actions.cancel')}
        </button>
        <button type="button" className="icon-button" onClick={onIgnore} disabled={isPending}>
          {t('calendar:copyOverwrite.ignore')}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onReplace}
          disabled={isPending || !canReplace}
          title={!canReplace ? t('calendar:copyOverwrite.noPermission') : undefined}
        >
          {isPending ? t('common:actions.saving') : t('calendar:copyOverwrite.replace')}
        </button>
      </div>
    </Modal>
  )
}
