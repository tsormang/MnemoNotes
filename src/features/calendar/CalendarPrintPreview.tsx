import { Printer } from 'lucide-react'
import { useEffect, useRef, type RefObject } from 'react'
import { Modal } from '../../components/Modal'
import { preparePrintClone } from './calendar-print'

interface CalendarPrintPreviewProps {
  open: boolean
  onClose: () => void
  title: string
  sourceRef: RefObject<HTMLElement | null>
  layoutReady: boolean
}

export function CalendarPrintPreview({
  open,
  onClose,
  title,
  sourceRef,
  layoutReady,
}: CalendarPrintPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !layoutReady || !previewRef.current || !sourceRef.current) return

    previewRef.current.replaceChildren(preparePrintClone(sourceRef.current))
  }, [open, layoutReady, sourceRef, title])

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal open={open} onClose={onClose} title="Print preview" wide>
      <p className="print-preview-subtitle">{title}</p>
      <div className="print-preview-frame">
        <div ref={previewRef} className="print-preview-surface" aria-label="Calendar print preview" />
      </div>
      <div className="form-actions print-preview-actions">
        <button type="button" className="icon-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="icon-button" onClick={handlePrint} disabled={!layoutReady}>
          <Printer size={16} aria-hidden="true" />
          Print
        </button>
      </div>
    </Modal>
  )
}
