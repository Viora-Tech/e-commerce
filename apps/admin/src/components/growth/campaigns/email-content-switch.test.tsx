// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emailBuilderContent } from '@/data/email-builder'
import EmailContentSwitch from './email-content-switch'

/* GrapesJS does not run in jsdom: the builder is a stub that can mark the canvas changed. */
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => (
      <button type="button" onClick={() => onDirtyChange(true)}>
        Change the canvas
      </button>
    ),
}))

const copy = emailBuilderContent.card

function renderSwitch() {
  return render(
    <EmailContentSwitch
      editor="visual"
      blocks={[]}
      design={null}
      storefrontUrl="https://shop.example"
      onChange={() => undefined}
    />,
  )
}

describe('EmailContentSwitch visual builder dialog', () => {
  it('opens the builder in the dialog shell and closes it on Esc', async () => {
    renderSwitch()
    await userEvent.click(screen.getByRole('button', { name: copy.open }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('asks before Esc drops changes made on the canvas', async () => {
    renderSwitch()
    await userEvent.click(screen.getByRole('button', { name: copy.open }))
    await userEvent.click(await screen.findByRole('button', { name: 'Change the canvas' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('button', { name: 'Change the canvas' })).toBeTruthy()
  })
})
