// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { themesContent } from '@/data/themes'
import ThemeActionsMenu from './theme-actions-menu'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}))

const copy = themesContent.library

describe('ThemeActionsMenu', () => {
  it('offers Preview for a theme that is not live, in a new tab', async () => {
    const user = userEvent.setup()
    render(
      <ThemeActionsMenu
        actions={['rename']}
        previewHref="https://www.waimers.in/?theme-preview=t"
        onAction={() => undefined}
      />,
    )
    await user.click(screen.getByRole('button', { name: copy.actions }))
    const item = await screen.findByRole('menuitem', { name: copy.preview })
    const link = item.closest('a') ?? item
    expect(link.getAttribute('href')).toBe('https://www.waimers.in/?theme-preview=t')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('has no Preview without a link', async () => {
    const user = userEvent.setup()
    render(<ThemeActionsMenu actions={['rename']} onAction={() => undefined} />)
    await user.click(screen.getByRole('button', { name: copy.actions }))
    await screen.findByRole('menuitem', { name: copy.rename })
    expect(screen.queryByRole('menuitem', { name: copy.preview })).toBeNull()
  })
})
