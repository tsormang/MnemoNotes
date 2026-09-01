import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationOffsetPicker } from './NotificationOffsetPicker'

describe('NotificationOffsetPicker', () => {
  it('toggles preset chips when custom mode is enabled', () => {
    const onOffsetsChange = vi.fn()

    render(
      <NotificationOffsetPicker
        offsets={[-30, 0]}
        useCustom
        onOffsetsChange={onOffsetsChange}
        onUseCustomChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '15 minutes before start' }))
    expect(onOffsetsChange).toHaveBeenCalledWith([-30, -15, 0])
  })

  it('shows org-default hint when custom mode is off', () => {
    render(
      <NotificationOffsetPicker
        offsets={[]}
        useCustom={false}
        onOffsetsChange={vi.fn()}
        onUseCustomChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Uses workspace default reminder times.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom reminders for this event' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
