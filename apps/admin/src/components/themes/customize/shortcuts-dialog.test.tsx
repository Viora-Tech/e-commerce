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
    await userEvent.setup().click(screen.getByRole('button', { name: copy.close }))
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})
