// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { themeImportContent } from '@/data/theme-import'
import { ImportedThemeContext } from '@/lib/customize-theme-context'
import type { ImportedTheme } from '@/lib/imported-sections'
import AddSectionBrowser from './add-section-browser'

const copy = customizeContent.addSection
const imported = themeImportContent.addPanel

const dispatch = vi.fn()
const puck = {
  dispatch,
  appState: { data: { root: { props: {} }, content: [], zones: {} } },
  config: {
    components: { Hero: { label: 'Hero' }, RichText: { label: 'Rich text' } },
    categories: {},
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))
vi.mock('@puckeditor/core', async (original) => {
  const Drawer = ({ children }: { children: ReactNode }) => children
  Drawer.Item = ({ children }: { children: () => ReactNode }) => children()
  return { ...(await original<typeof import('@puckeditor/core')>()), Drawer }
})
vi.mock('@/lib/customize-my-sections', () => ({
  useMySections: () => ({ status: 'ready', items: [] }),
  deleteMySection: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const THEME: ImportedTheme = {
  schemaLocale: {},
  blockSchemas: {},
  schemas: {
    'zd-marquee': {
      name: 'Marquee strip',
      settings: [{ type: 'text', id: 'text', default: 'Free shipping' }],
      presets: [{ name: 'Marquee strip' }],
    },
    header: { name: 'Header' },
  },
}

function setup(theme: ImportedTheme | null, props: { group?: 'header' | null } = {}) {
  render(
    <ImportedThemeContext.Provider value={theme}>
      <AddSectionBrowser zone="root:default-zone" group={props.group ?? null} index={1} count={3} />
    </ImportedThemeContext.Provider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  dispatch.mockClear()
  toast.success.mockClear()
})

describe('AddSectionBrowser: imported Shopify sections', () => {
  it('shows a group of the theme own sections apart from the library, with a Shopify badge', () => {
    setup(THEME)
    expect(screen.getByRole('button', { name: imported.title })).toBeTruthy()
    const card = screen.getByRole('button', { name: imported.cardLabel('Marquee strip') })
    expect(card.textContent).toContain(imported.badge)
    // Sections without a preset are the theme's to place, not the merchant's to add.
    expect(screen.queryByText('Header', { selector: 'span' })).toBeNull()
    // The library is still there, in its own groups.
    expect(screen.getByText('Rich text', { selector: 'span' })).toBeTruthy()
  })

  it('has no such group for one of our own themes', () => {
    setup(null)
    expect(screen.queryByRole('button', { name: imported.title })).toBeNull()
  })

  it('has none in a header or footer group', () => {
    setup(THEME, { group: 'header' })
    expect(screen.queryByRole('button', { name: imported.title })).toBeNull()
  })

  it('adds the section from its preset where the panel was opened', async () => {
    const user = setup(THEME)
    await user.click(screen.getByRole('button', { name: imported.cardLabel('Marquee strip') }))
    const [insert, replace, select] = dispatch.mock.calls.map(([action]) => action)
    expect(insert).toMatchObject({
      type: 'insert',
      componentType: 'LiquidSection',
      destinationIndex: 1,
      destinationZone: 'root:default-zone',
    })
    expect(replace.data.props).toMatchObject({
      sectionType: 'zd-marquee',
      _name: 'Marquee strip',
      text: 'Free shipping',
    })
    // A fresh id, so a second copy never shares element ids with the first.
    expect(replace.data.props.id).toBe(insert.id)
    expect(replace.data.props.id).not.toBe('LiquidSection-zd-marquee')
    expect(select.type).toBe('setUi')
    expect(toast.success).toHaveBeenCalledWith(imported.added('Marquee strip'))
  })

  it('searches the library and the imported group together', async () => {
    const user = setup(THEME)
    const search = screen.getByRole('searchbox', { name: copy.search })
    await user.type(search, 'marquee')
    expect(screen.getByRole('button', { name: imported.cardLabel('Marquee strip') })).toBeTruthy()
    expect(screen.queryByText('Rich text', { selector: 'span' })).toBeNull()
    // Imported matches alone are not an empty search.
    expect(screen.queryByText(copy.empty)).toBeNull()
    await user.clear(search)
    await user.type(search, 'rich')
    expect(screen.queryByRole('button', { name: imported.title })).toBeNull()
    expect(screen.getByText('Rich text', { selector: 'span' })).toBeTruthy()
  })
})
