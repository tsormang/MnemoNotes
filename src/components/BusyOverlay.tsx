import { Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'

interface BusyOverlayProps {
  open: boolean
  label: string
}

/** Blocks interaction and shows a spinner while a long calendar mutation runs. */
export function BusyOverlay({ open, label }: BusyOverlayProps) {
  if (!open) return null

  return createPortal(
    <div className="busy-overlay" role="alert" aria-busy="true" aria-live="assertive">
      <div className="busy-overlay__card">
        <Loader2 className="busy-overlay__spinner" size={28} aria-hidden="true" data-spin="true" />
        <p className="busy-overlay__label">{label}</p>
      </div>
    </div>,
    document.body,
  )
}
