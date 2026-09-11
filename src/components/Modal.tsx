import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useExclusiveOverlay } from '../lib/exclusive-overlay'

type ModalVariant = 'modal' | 'panel'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  variant?: ModalVariant
  wide?: boolean
  /** When true, Escape / backdrop / close button do not dismiss the dialog. */
  busy?: boolean
  /**
   * When true (default), opening this dialog closes other root popups, and
   * another exclusive overlay will close this one.
   */
  exclusive?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  variant = 'modal',
  wide = false,
  busy = false,
  exclusive = true,
}: ModalProps) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useExclusiveOverlay(open && exclusive, onClose, busy)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, busy])

  if (!open) return null

  return createPortal(
    <div
      className={`modal-root ${variant === 'panel' ? 'modal-root--panel' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (busy) return
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`modal-dialog ${wide ? 'modal-dialog--wide' : ''} ${
          variant === 'panel' ? 'modal-dialog--panel' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-ghost"
            type="button"
            aria-label={t('actions.close')}
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
