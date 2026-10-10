// @vitest-environment jsdom
import { defaultPreferences } from '@commerce/core/preferences'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import HomePageSettings from './home-page-settings'

const copy = customizeContent.pageSettings

const store = vi.hoisted(() => ({ getPreferences: vi.fn(), updatePreferences: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { store } }))
vi.mock('@/components/media/media-pick-dialog', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const prefs = {
  ...defaultPreferences,
  seo: { ...defaultPreferences.seo, title: 'Waimers', description: 'Glasspads' },
}

beforeEach(() => {
  store.getPreferences.mockReset().mockResolvedValue(prefs)
  store.updatePreferences.mockReset().mockImplementation(async (next: unknown) => next)
})

describe('HomePageSettings', () => {
  it('loads the listing and previews it as Google might', async () => {
    render(<HomePageSettings title="Home page" domain="waimers.in" />)
    expect(await screen.findByDisplayValue('Waimers')).toBeTruthy()
    expect(screen.getByText('waimers.in')).toBeTruthy()
    expect(screen.queryByRole('button', { name: copy.save })).toBeNull()
  })

  it('saves a changed SEO title to the store preferences', async () => {
    const user = userEvent.setup()
    render(<HomePageSettings title="Home page" domain="waimers.in" />)
    const title = await screen.findByLabelText(copy.seoTitle)
    await user.clear(title)
    await user.type(title, 'Waimers glasspads')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(store.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ seo: expect.objectContaining({ title: 'Waimers glasspads' }) }),
    )
  })

  it('will not save a store password shorter than the minimum', async () => {
    const user = userEvent.setup()
    render(<HomePageSettings title="Home page" domain="waimers.in" />)
    await user.click(await screen.findByRole('radio', { name: copy.visibilities.password }))
    await user.type(screen.getByLabelText(copy.password), 'abc')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: copy.save }).disabled).toBe(true)
    await user.type(screen.getByLabelText(copy.password), 'd')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: copy.save }).disabled).toBe(false)
  })

  it('offers Try again when the settings cannot load', async () => {
    store.getPreferences.mockRejectedValueOnce(new Error('down'))
    render(<HomePageSettings title="Home page" domain="waimers.in" />)
    expect(await screen.findByRole('button', { name: copy.retry })).toBeTruthy()
  })
})
