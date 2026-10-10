// @vitest-environment jsdom
import type { TemplateSection } from '@commerce/core/theme'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import SectionTreeItem from './section-tree-item'

const tree = customizeContent.tree

// A Puck store with one component type whose `slides` array field is its blocks.
const dispatch = vi.fn()
const puck = {
  dispatch,
  config: {
    components: {
      Hero: {
        label: 'Hero',
        fields: {
          heading: { type: 'text' },
          slides: {
            type: 'array',
            label: 'Slides',
            defaultItemProps: { title: 'New slide' },
            getItemSummary: (item: Record<string, unknown>) => String(item.title ?? ''),
          },
        },
      },
    },
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))
vi.mock('@puckeditor/core', async (original) => ({
  ...(await original<typeof import('@puckeditor/core')>()),
  useGetPuck: () => () => ({ appState: { data: { content: [], root: { props: {} } } } }),
}))
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
const motion = vi.hoisted(() => ({ scrollToSection: vi.fn(), deleteWithCollapse: vi.fn() }))
vi.mock('@/lib/customize-canvas-motion', () => motion)
// Its own tests cover the add popover; the save dialog talks to the API.
vi.mock('./add-section-popover', () => ({ default: () => null }))
vi.mock('./save-section-dialog', () => ({
  default: ({ defaultName }: { defaultName: string }) => <div role="dialog">{defaultName}</div>,
}))

function hero(props: Record<string, unknown> = {}): TemplateSection {
  return {
    type: 'Hero',
    props: {
      id: 'hero-1',
      slides: [{ title: 'Summer' }, { title: 'Winter' }],
      ...props,
    },
  } as TemplateSection
}

function setup(section = hero(), overrides: Record<string, unknown> = {}) {
  render(
    <SectionTreeItem
      section={section}
      zone="root:default-zone"
      group={null}
      index={2}
      count={4}
      label="Hero"
      selected={false}
      locked={false}
      handle={null}
      isNew={false}
      {...overrides}
    />,
  )
  return userEvent.setup()
}

/** The `data` of the last `replace` dispatched. */
function replaced(): TemplateSection {
  const call = dispatch.mock.calls.findLast(([a]) => a.type === 'replace')
  if (!call) throw new Error('Nothing was replaced')
  return (call[0] as { data: TemplateSection }).data
}

beforeEach(() => {
  dispatch.mockClear()
  motion.scrollToSection.mockClear()
  motion.deleteWithCollapse.mockClear()
})

describe('SectionTreeItem', () => {
  it('selects the section in Puck, scrolls the canvas to it and opens its blocks', async () => {
    const user = setup()
    expect(screen.queryByRole('button', { name: tree.selectBlock('Summer') })).toBeNull()
    await user.click(screen.getByRole('button', { name: tree.select('Hero') }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setUi',
      ui: { itemSelector: { index: 2, zone: 'root:default-zone' } },
    })
    expect(motion.scrollToSection).toHaveBeenCalledWith('hero-1', true)
    expect(screen.getByRole('button', { name: tree.selectBlock('Summer') })).toBeTruthy()
  })

  it('shows its merchant-given name instead of the type label', () => {
    setup(hero({ _name: 'Big banner' }))
    expect(screen.getByRole('button', { name: tree.select('Big banner') })).toBeTruthy()
  })

  it('toggles the blocks list', async () => {
    const user = setup()
    const toggle = screen.getByRole('button', { name: tree.showChildren('Hero') })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: tree.selectBlock('Winter') })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: tree.hideChildren('Hero') }))
    expect(screen.queryByRole('button', { name: tree.selectBlock('Winter') })).toBeNull()
  })

  it('hides and shows the section through a replace that keeps its id', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: tree.hide('Hero') }))
    expect(replaced().props).toMatchObject({ id: 'hero-1', _hidden: true })
  })

  it('adds a block with the field defaults and removes one by index', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: tree.showChildren('Hero') }))
    await user.click(screen.getByRole('button', { name: tree.addBlock }))
    expect(replaced().props.slides).toEqual([
      { title: 'Summer' },
      { title: 'Winter' },
      { title: 'New slide' },
    ])
    await user.click(screen.getByRole('button', { name: tree.removeBlock('Summer') }))
    expect(replaced().props.slides).toEqual([{ title: 'Winter' }])
  })

  it('renames inline: Enter saves, Escape cancels', async () => {
    const user = setup()
    await user.dblClick(screen.getByRole('button', { name: tree.select('Hero') }))
    const input = screen.getByRole('textbox', { name: tree.renameLabel('Hero') })
    await user.clear(input)
    await user.type(input, 'Main banner{Enter}')
    expect(replaced().props).toMatchObject({ id: 'hero-1', _name: 'Main banner' })

    dispatch.mockClear()
    await user.dblClick(screen.getByRole('button', { name: tree.select('Hero') }))
    await user.type(screen.getByRole('textbox', { name: tree.renameLabel('Hero') }), 'x{Escape}')
    // The double click also selects the row; nothing is renamed.
    expect(dispatch.mock.calls.some(([a]) => a.type === 'replace')).toBe(false)
  })

  it('duplicates, saves as my section and removes from the more menu', async () => {
    const user = setup()
    const more = () => screen.getByRole('button', { name: tree.more('Hero') })

    await user.click(more())
    await user.click(await screen.findByRole('menuitem', { name: tree.duplicateItem }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'duplicate',
      sourceIndex: 2,
      sourceZone: 'root:default-zone',
    })

    await user.click(more())
    await user.click(await screen.findByRole('menuitem', { name: tree.saveAsSection }))
    expect(screen.getByRole('dialog').textContent).toBe('Hero')

    await user.click(more())
    await user.click(await screen.findByRole('menuitem', { name: tree.removeItem }))
    expect(motion.deleteWithCollapse).toHaveBeenCalledWith(
      dispatch,
      { index: 2, zone: 'root:default-zone' },
      expect.anything(),
      true,
    )
  })

  it('a locked section can be renamed but not duplicated, saved or removed', async () => {
    const user = setup(hero(), { locked: true })
    await user.click(screen.getByRole('button', { name: tree.more('Hero') }))
    expect(await screen.findByRole('menuitem', { name: tree.rename })).toBeTruthy()
    for (const name of [tree.duplicateItem, tree.saveAsSection, tree.removeItem])
      expect(screen.queryByRole('menuitem', { name })).toBeNull()
  })

  it('offers "Move out" only for a block nested in a container', async () => {
    const user = setup(hero(), { parentName: 'Columns', depth: 1 })
    await user.click(screen.getByRole('button', { name: tree.more('Hero') }))
    expect(await screen.findByRole('menuitem', { name: tree.moveOut('Columns') })).toBeTruthy()
  })
})
