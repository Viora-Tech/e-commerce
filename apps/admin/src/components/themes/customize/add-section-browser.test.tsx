// @vitest-environment jsdom
import type { CustomSection } from '@commerce/core/theme'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import AddSectionBrowser from './add-section-browser'

const copy = customizeContent.addSection

// A Puck store with a few labelled sections and one app block.
const dispatch = vi.fn()
const puck = {
  dispatch,
  config: {
    components: {
      Hero: { label: 'Hero' },
      RichText: { label: 'Rich text' },
      AnnouncementBar: { label: 'Announcement bar' },
      ReviewsWidget: { label: 'Product reviews' },
    },
    categories: { apps: { components: ['ReviewsWidget'] } },
    appBlockOwners: { ReviewsWidget: { appName: 'Reviews' } },
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))
// Puck's drawer needs its drag-and-drop context; here a card is only clicked.
vi.mock('@puckeditor/core', async (original) => {
  const Drawer = ({ children }: { children: ReactNode }) => children
  Drawer.Item = ({ children }: { children: () => ReactNode }) => children()
  return { ...(await original<typeof import('@puckeditor/core')>()), Drawer }
})
vi.mock('@commerce/blocks/puck', async (original) => ({
  ...(await original<typeof import('@commerce/blocks/puck')>()),
  APPS_CATEGORY: 'apps',
}))
const saved = vi.hoisted(() => ({
  state: { status: 'ready', items: [] as CustomSection[] },
}))
vi.mock('@/lib/customize-my-sections', () => ({
  useMySections: () => saved.state,
  deleteMySection: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const BANNER = {
  id: 's1',
  name: 'Sale banner',
  thumbnail: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  block: { type: 'Hero', props: { id: 'old-id', heading: 'Sale' } },
} as unknown as CustomSection

function setup(props: Partial<Parameters<typeof AddSectionBrowser>[0]> = {}) {
  const onAdd = vi.fn()
  render(
    <AddSectionBrowser
      zone="root:default-zone"
      group={null}
      index={1}
      count={3}
      onAdd={onAdd}
      {...props}
    />,
  )
  return { onAdd, user: userEvent.setup() }
}

/** A section card, by its caption; null when the list doesn't offer it. */
const findCard = (label: string) =>
  screen.queryByText(label, { selector: 'span' })?.closest<HTMLElement>('[role="button"]') ?? null

function card(label: string): HTMLElement {
  const found = findCard(label)
  if (!found) throw new Error(`No "${label}" card`)
  return found
}

beforeEach(() => {
  dispatch.mockClear()
  toast.success.mockClear()
  saved.state = { status: 'ready', items: [] }
})

describe('AddSectionBrowser', () => {
  it('adds a clicked section where the panel was opened and selects it', async () => {
    const { onAdd, user } = setup()
    await user.click(card('Rich text'))
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      {
        type: 'insert',
        componentType: 'RichText',
        destinationIndex: 1,
        destinationZone: 'root:default-zone',
      },
      { type: 'setUi', ui: { itemSelector: { index: 1, zone: 'root:default-zone' } } },
    ])
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('keeps the insert index inside the zone', async () => {
    const { user } = setup({ index: 9, count: 3 })
    await user.click(card('Hero'))
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ destinationIndex: 3 })
  })

  it('adds from the keyboard too', async () => {
    const { user } = setup()
    card('Hero').focus()
    await user.keyboard('{Enter}')
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: 'insert', componentType: 'Hero' })
  })

  it('filters by name or description and says when nothing matches', async () => {
    const { user } = setup()
    const search = screen.getByRole('textbox', { name: copy.search })
    await user.type(search, 'formatted text')
    expect(card('Rich text')).toBeTruthy()
    expect(findCard('Hero')).toBeNull()
    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByText(copy.empty)).toBeTruthy()
  })

  it("offers only a group's own sections and no saved sections in a header or footer", () => {
    setup({ group: 'header' })
    expect(card('Announcement bar')).toBeTruthy()
    expect(findCard('Hero')).toBeNull()
    expect(screen.queryByRole('tab', { name: copy.tabs.mine })).toBeNull()
  })

  it('lists app blocks under their app on the Apps tab', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: copy.tabs.apps }))
    expect(screen.getByText('Reviews')).toBeTruthy()
    await user.click(card('Product reviews'))
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ componentType: 'ReviewsWidget' })
  })

  it('adds a fresh copy of a saved section from My sections', async () => {
    saved.state = { status: 'ready', items: [BANNER] }
    const { onAdd, user } = setup()
    await user.click(screen.getByRole('tab', { name: copy.tabs.mine }))
    await user.click(screen.getByRole('button', { name: /^Sale banner/ }))
    const [insert, replace] = dispatch.mock.calls.map(([action]) => action)
    expect(insert).toMatchObject({ type: 'insert', componentType: 'Hero', destinationIndex: 1 })
    expect(replace.data.props.heading).toBe('Sale')
    expect(replace.data.props.id).not.toBe('old-id')
    expect(toast.success).toHaveBeenCalledWith(customizeContent.mySections.added('Sale banner'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when nothing is saved yet', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: copy.tabs.mine }))
    expect(screen.getByText(customizeContent.mySections.empty)).toBeTruthy()
  })
})
