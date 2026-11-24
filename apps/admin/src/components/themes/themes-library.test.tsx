// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import type { ThemeItem } from './theme-types'
import ThemesLibrary from './themes-library'

const themes = vi.hoisted(() => ({ publish: vi.fn(), list: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { themes } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/link', () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock('./current-theme-card', () => ({ default: () => null }))
vi.mock('./add-theme-menu', () => ({ default: () => null }))
vi.mock('./add-theme-dialog', () => ({ default: () => null }))
vi.mock('./theme-packs-card', () => ({ default: () => null }))
vi.mock('./theme-version-history', () => ({ default: () => null }))
vi.mock('./web-performance-strip', () => ({ default: () => null }))
vi.mock('./theme-library-row', () => ({
  default: ({ theme, onPublish }: { theme: ThemeItem; onPublish: () => void }) => (
    <li>
      <button type="button" onClick={onPublish}>
        Publish {theme.name}
      </button>
    </li>
  ),
}))

const copy = customizeContent.publishDialog

const theme = (id: string, name: string, role: 'main' | 'unpublished') =>
  ({ id, name, role, updatedAt: new Date().toISOString(), settings: {} }) as unknown as ThemeItem

const initial = [
  theme('11111111-1111-4111-8111-111111111111', 'Zero Drift', 'main'),
  theme('22222222-2222-4222-8222-222222222222', 'Diwali', 'unpublished'),
]

beforeEach(() => {
  themes.publish.mockReset().mockImplementation(async ({ id }: { id: string }) => ({
    ...initial[1],
    id,
    role: 'main',
  }))
})

describe('ThemesLibrary publish', () => {
  it('asks before a library theme goes live, naming both themes and the address', async () => {
    const user = userEvent.setup()
    render(<ThemesLibrary initial={initial} origin="https://www.waimers.in" canPublish />)
    await user.click(screen.getByRole('button', { name: 'Publish Diwali' }))
    expect(themes.publish).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(copy.title('Diwali'))).toBeTruthy()
    expect(within(dialog).getByText(copy.body('Zero Drift', 'www.waimers.in'))).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: copy.publish }))
    expect(themes.publish).toHaveBeenCalledWith({ id: initial[1]?.id })
  })

  it('leaves the live theme alone when the merchant cancels', async () => {
    const user = userEvent.setup()
    render(<ThemesLibrary initial={initial} origin="https://www.waimers.in" canPublish />)
    await user.click(screen.getByRole('button', { name: 'Publish Diwali' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: copy.cancel }))
    expect(themes.publish).not.toHaveBeenCalled()
  })
})
