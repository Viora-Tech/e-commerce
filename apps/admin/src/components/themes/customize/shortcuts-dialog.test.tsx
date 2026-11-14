// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import ShortcutsDialog from './shortcuts-dialog'

const copy = customizeContent.help

describe('ShortcutsDialog', () => {
  it('lists every shortcut under its title', () => {
    render(<ShortcutsDialog open onOpenChange={() => {}} />)
    expect(screen.getByRole('dialog', { name: copy.dialogTitle })).toBeTruthy()
    for (const name of Object.values(copy.keys)) expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText('1 2 3')).toBeTruthy()
  })

  it('closes from Close', async () => {
    const onOpenChange = vi.fn()
    render(<ShortcutsDialog open onOpenChange={onOpenChange} />)
    // The footer's Close and the corner X share the name; each closes the dialog.
    for (const button of screen.getAllByRole('button', { name: copy.close })) {
      await userEvent.setup().click(button)
    }
    expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([false, false])
  })
})
