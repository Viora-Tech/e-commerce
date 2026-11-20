// @vitest-environment jsdom
import { defaultTheme, type Theme } from '@commerce/core/theme'
import type { ImportedAppEmbed } from '@commerce/core/theme-import'
import { FLOATING_TAB } from '@commerce/plugin-reviews/blocks'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { themeEditorAppsContent as copy } from '@/data/theme-editor-apps'
import { InstalledAppsContext, ThemePreviewContext } from '@/lib/customize-theme-context'
import AppsPanel from './apps-panel'
import CanvasAppEmbeds from './canvas-app-embeds'

const reviews = vi.hoisted(() => ({ widgets: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { reviews, inbox: { settings: { get: vi.fn() } } } }))
vi.mock('@/components/pickers/resource-pick-dialog', () => ({ default: () => null }))

const DATA = {
  summary: { rating: 4.8, count: 2, stars: [0, 0, 0, 0, 2] },
  reviews: [
    {
      id: 'r1',
      rating: 5,
      title: 'Great',
      body: 'Lovely keyboard',
      author: 'Asha',
      createdAt: '2026-11-01T00:00:00Z',
      photos: [],
      product: null,
    },
  ],
}

beforeEach(() => {
  reviews.widgets.mockReset().mockResolvedValue(DATA)
})

const withTab = (enabled: boolean): Theme => ({
  ...defaultTheme,
  appEmbeds: { [FLOATING_TAB]: { enabled, settings: {} } },
})

function canvas(theme: Theme, installed: string[]) {
  return render(
    <ThemePreviewContext.Provider value={theme}>
      <InstalledAppsContext.Provider value={installed}>
        <CanvasAppEmbeds />
      </InstalledAppsContext.Provider>
    </ThemePreviewContext.Provider>,
  )
}

describe('CanvasAppEmbeds', () => {
  it('draws the floating reviews tab when it is on, with the store reviews', async () => {
    const { container } = canvas(withTab(true), ['reviews'])
    await vi.waitFor(() => expect(container.textContent).toContain('4.8'))
    expect(reviews.widgets).toHaveBeenCalledWith({ limit: 10, minRating: 4 })
  })

  it('draws nothing when the embed is off or the app is not installed', async () => {
    const off = canvas(withTab(false), ['reviews'])
    expect(off.container.textContent).toBe('')
    off.unmount()
    const missing = canvas(withTab(true), [])
    expect(missing.container.textContent).toBe('')
    expect(reviews.widgets).not.toHaveBeenCalled()
  })
})

describe('App embeds panel: the imported theme', () => {
  it('lists the Shopify app embeds with which of our apps shows each', () => {
    const imported: ImportedAppEmbed[] = [
      {
        id: '1',
        type: 'shopify://apps/inbox/blocks/chat/a',
        name: 'Inbox: Chat',
        enabled: true,
        ours: 'inbox',
      },
      {
        id: '2',
        type: 'shopify://apps/x/blocks/banner/b',
        name: 'X: Banner',
        enabled: true,
        ours: null,
      },
      {
        id: '3',
        type: 'shopify://apps/y/blocks/pop/c',
        name: 'Y: Pop',
        enabled: false,
        ours: null,
      },
    ]
    render(<AppsPanel installed={[]} theme={defaultTheme} onChange={vi.fn()} imported={imported} />)
    expect(screen.getByText(copy.importedEmbeds)).toBeTruthy()
    expect(screen.getByText(copy.embedOurs('Inbox'))).toBeTruthy()
    expect(screen.getByText(copy.embedMissing)).toBeTruthy()
    expect(screen.getByText(copy.embedOff)).toBeTruthy()
  })
})
