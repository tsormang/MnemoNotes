import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { announceExclusiveOverlay } from '../lib/exclusive-overlay'
import { Modal } from './Modal'

function DualModals() {
  const [firstOpen, setFirstOpen] = useState(true)
  const [secondOpen, setSecondOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setSecondOpen(true)}>
        Open second
      </button>
      <Modal open={firstOpen} onClose={() => setFirstOpen(false)} title="First dialog">
        First body
      </Modal>
      <Modal open={secondOpen} onClose={() => setSecondOpen(false)} title="Second dialog">
        Second body
      </Modal>
    </>
  )
}

describe('Modal exclusive overlay', () => {
  it('keeps only the newly opened modal on screen', () => {
    render(<DualModals />)

    expect(screen.getByRole('dialog', { name: 'First dialog' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Second dialog' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open second' }))

    expect(screen.queryByRole('dialog', { name: 'First dialog' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Second dialog' })).toBeInTheDocument()
  })

  it('closes when a foreign overlay is announced', () => {
    function Closable() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Closable dialog">
          Body
        </Modal>
      )
    }

    render(<Closable />)
    expect(screen.getByRole('dialog', { name: 'Closable dialog' })).toBeInTheDocument()

    act(() => {
      announceExclusiveOverlay('foreign')
    })
    expect(screen.queryByRole('dialog', { name: 'Closable dialog' })).not.toBeInTheDocument()
  })
})
