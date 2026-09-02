import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import type { ScheduleAction } from '../../lib/calendar-schedule-copy'

export type ScheduleCopyScope = 'day' | 'week' | 'month'

interface CalendarScheduleCopyModalProps {
  open: boolean
  scope: ScheduleCopyScope
  isPending: boolean
  errorMessage: string | null
  onClose: () => void
  onAction: (action: ScheduleAction) => void
}

const copyOptions: Record<
  ScheduleCopyScope,
  Array<{ action: ScheduleAction; labelKey: string }>
> = {
  day: [
    { action: { type: 'copy', copy: { scope: 'day', mode: 'next-day' } }, labelKey: 'dayNextDay' },
    { action: { type: 'copy', copy: { scope: 'day', mode: 'week' } }, labelKey: 'dayWeek' },
    { action: { type: 'copy', copy: { scope: 'day', mode: 'month' } }, labelKey: 'dayMonth' },
    { action: { type: 'clear', scope: 'day' }, labelKey: 'clearDay' },
  ],
  week: [
    { action: { type: 'copy', copy: { scope: 'week', mode: 'next-week' } }, labelKey: 'weekNextWeek' },
    { action: { type: 'copy', copy: { scope: 'week', mode: 'month' } }, labelKey: 'weekMonth' },
    { action: { type: 'clear', scope: 'week' }, labelKey: 'clearWeek' },
  ],
  month: [
    { action: { type: 'copy', copy: { scope: 'month', mode: 'next-month' } }, labelKey: 'monthNextMonth' },
    { action: { type: 'clear', scope: 'month' }, labelKey: 'clearMonth' },
  ],
}

export function CalendarScheduleCopyModal({
  open,
  scope,
  isPending,
  errorMessage,
  onClose,
  onAction,
}: CalendarScheduleCopyModalProps) {
  const { t } = useTranslation('calendar')

  return (
    <Modal open={open} onClose={onClose} title={t('scheduleCopy.title')}>
      <p className="schedule-copy-modal__hint">{t('scheduleCopy.sundayHint')}</p>
      <div className="schedule-copy-modal__options" role="menu" aria-label={t('scheduleCopy.title')}>
        {copyOptions[scope].map((entry) => (
          <button
            key={entry.labelKey}
            type="button"
            role="menuitem"
            className="schedule-copy-modal__option"
            disabled={isPending}
            onClick={() => onAction(entry.action)}
          >
            {t(`scheduleCopy.${entry.labelKey}`)}
          </button>
        ))}
      </div>
      {errorMessage ? <p className="schedule-copy-modal__error">{errorMessage}</p> : null}
    </Modal>
  )
}
