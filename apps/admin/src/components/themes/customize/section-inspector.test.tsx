// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useContext } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { InspectorTabContext } from '@/lib/customize-inspector-tab'
import SectionInspector from './section-inspector'

const copy = customizeContent.inspector
const panels = customizeContent.panels

const SETTINGS = { type: 'object', objectFields: { spacing: {}, advanced: {} } }

type Selected = { type: string; props: Record<string, unknown> } | null

// A Puck store: one plain section, one with Advanced settings, one with no fields, and the
// product page's main section (which can't be removed).
const dispatch = vi.fn()
const puck = {
  dispatch,
  selectedItem: null as Selected,
  config: {
    components: {
      RichText: { label: 'Rich text', fields: { text: { type: 'textarea' } } },
      Hero: { label: 'Hero', fields: { heading: { type: 'text' }, settings: SETTINGS } },
      Divider: { label: 'Divider', fields: {} },
      MainProduct: { label: 'Product information', fields: { gallery: { type: 'radio' } } },
    },
  },
  appState: {
    data: {
      root: { props: {} },
      content: [
        { type: 'RichText', props: { id: 'text-1' } },
        { type: 'Hero', props: { id: 'hero-1' } },
      ],
      zones: {},
    },
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))
// Puck draws the fields; the stub shows which tab it was told to draw.
vi.mock('@puckeditor/core', async (original) => {
  const actual = await original<typeof import('@puckeditor/core')>()
  const Fields = () => <div data-testid="fields">{String(useContext(InspectorTabContext))}</div>
  return { ...actual, Puck: { ...actual.Puck, Fields } }
})
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
const motion = vi.hoisted(() => ({ deleteWithCollapse: vi.fn() }))
vi.mock('@/lib/customize-canvas-motion', () => motion)
vi.mock('./inspector-breadcrumb', () => ({ default: () => null }))

function setup(selected: Selected) {
  puck.selectedItem = selected
  render(<SectionInspector settings={<p>Theme settings form</p>} />)
  return userEvent.setup()
}

beforeEach(() => {
  dispatch.mockClear()
  motion.deleteWithCollapse.mockClear()
})

describe('SectionInspector', () => {
  it('shows the theme settings when nothing is selected', () => {
    setup(null)
    expect(screen.getByRole('region', { name: panels.theme })).toBeTruthy()
    expect(screen.getByText('Theme settings form')).toBeTruthy()
  })

  it('names the selected section, by its merchant-given name when it has one', () => {
    setup({ type: 'RichText', props: { id: 'text-1', _name: 'Shipping note' } })
    expect(screen.getByRole('heading', { name: 'Shipping note' })).toBeTruthy()
    expect(screen.getByRole('region', { name: copy.label })).toBeTruthy()
  })

  it('draws every field at once when the section has no Advanced settings', () => {
    setup({ type: 'RichText', props: { id: 'text-1' } })
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByTestId('fields').textContent).toBe('all')
  })

  it('splits Basic and Advanced when the section has section settings', async () => {
    const user = setup({ type: 'Hero', props: { id: 'hero-1' } })
    const basic = screen.getByRole('tab', { name: copy.tabs.basic })
    expect(basic.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('fields').textContent).toBe('basic')
    expect(screen.getByText(copy.tabHints.basic)).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: copy.tabs.advanced }))
    expect(screen.getByTestId('fields').textContent).toBe('advanced')
    expect(screen.getByText(copy.tabHints.advanced)).toBeTruthy()
  })

  it('says so when a section has no settings', () => {
    setup({ type: 'Divider', props: { id: 'divider-1' } })
    expect(screen.getByText(copy.emptyFields)).toBeTruthy()
    expect(screen.queryByTestId('fields')).toBeNull()
  })

  it('removes the selected section where it sits', async () => {
    const user = setup({ type: 'Hero', props: { id: 'hero-1' } })
    await user.click(screen.getByRole('button', { name: copy.remove('Hero') }))
    expect(motion.deleteWithCollapse).toHaveBeenCalledWith(
      dispatch,
      { zone: 'root:default-zone', index: 1 },
      null,
      true,
    )
  })

  it("offers no remove for the page's main section", () => {
    setup({ type: 'MainProduct', props: { id: 'main-1' } })
    expect(screen.queryByRole('button', { name: copy.remove('Product information') })).toBeNull()
  })

  it('goes back to the theme settings', async () => {
    const user = setup({ type: 'RichText', props: { id: 'text-1' } })
    await user.click(screen.getByRole('button', { name: panels.deselect }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setUi', ui: { itemSelector: null } })
  })
})
