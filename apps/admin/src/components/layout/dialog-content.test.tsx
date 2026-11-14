// @vitest-environment jsdom
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './confirm-dialog'
import DialogContent from './dialog-content'
import DialogHeader from './dialog-header'

function Shell({
  busy = false,
  dirty = false,
  onOpenChange,
}: {
  busy?: boolean
  dirty?: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent busy={busy} dirty={dirty}>
        <DialogHeader>
          <DialogTitle>Refund</DialogTitle>
        </DialogHeader>
        <input aria-label="Amount" />
      </DialogContent>
    </Dialog>
  )
}

describe('DialogContent busy and dirty', () => {
  it('closes on Esc when idle', async () => {
    const onOpenChange = vi.fn()
    render(<Shell onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })

  it('stays open on Esc and greys the X while busy', async () => {
    const onOpenChange = vi.fn()
    render(<Shell busy onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  })

  it('asks before dropping typed input, then closes on Discard', async () => {
    const onOpenChange = vi.fn()
    render(<Shell dirty onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything()))
  })

  it('keeps the dialog when the person chooses Keep editing', async () => {
    const onOpenChange = vi.fn()
    render(<Shell dirty onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog on the shell', () => {
  it('shows title, body and both buttons, and confirms', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete product?"
        body="It is gone for good."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('It is gone for good.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('cannot be closed while it works', async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel order?"
        confirmLabel="Cancel order"
        tone="destructive"
        busy
        onConfirm={() => {}}
      />,
    )
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  })
})
