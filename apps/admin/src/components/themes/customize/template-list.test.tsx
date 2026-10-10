// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import type { useTemplateManager } from '@/lib/use-template-manager'
import TemplateList from './template-list'

const copy = customizeContent.templates

type Manager = ReturnType<typeof useTemplateManager>

/** The manager's surface the list reads: usage counts and the alternate actions. */
function fakeManager(used: Record<string, number> = {}): Manager {
  return {
    usedBy: (kind: string, suffix: string) => used[`${kind}.${suffix}`] ?? 0,
    duplicate: vi.fn(async () => undefined),
    setPending: vi.fn(),
  } as unknown as Manager
}

const ALTERNATES = [
  { template: 'product', suffix: 'preorder' },
  { template: 'page', suffix: 'contact' },
]

function setup(overrides: Partial<Parameters<typeof TemplateList>[0]> = {}) {
  const props = {
    value: { key: 'home' as const, suffix: '' },
    alternates: ALTERNATES,
    manager: fakeManager({ 'product.preorder': 2 }),
    onPick: vi.fn(),
    onCreate: vi.fn(),
    onAction: vi.fn(),
    ...overrides,
  }
  render(<TemplateList {...props} />)
  return { props, user: userEvent.setup() }
}

const option = (name: string | RegExp) => screen.getByRole('option', { name })

describe('TemplateList', () => {
  it('lists every kind by name, templates marked "Default"', () => {
    setup()
    const products = screen.getByRole('group', { name: copy.names.product })
    expect(
      within(products).getByRole('option', { name: `${copy.names.product}${copy.default}` }),
    ).toBeTruthy()
    expect(within(products).getByRole('option', { name: /preorder/ })).toBeTruthy()
    const collections = screen.getByRole('group', { name: copy.names.collection })
    expect(
      within(collections).getByRole('option', { name: `${copy.names.collection}${copy.default}` }),
    ).toBeTruthy()
    expect(screen.getByRole('option', { name: copy.names.home })).toBeTruthy()
  })

  it('marks the open template and shows how many resources use an alternate', () => {
    setup({ value: { key: 'product', suffix: 'preorder' } })
    const row = option(/preorder/)
    expect(row.getAttribute('data-checked')).toBe('true')
    expect(within(row).getByText(copy.usedBy(2, 'product'))).toBeTruthy()
    // Nobody uses the page alternate, so it has no count.
    expect(option(/contact/).textContent).not.toMatch(/\d/)
  })

  it('picks the default template or an alternate', async () => {
    const { props, user } = setup()
    await user.click(option(copy.names.home))
    expect(props.onPick).toHaveBeenLastCalledWith({ key: 'home', suffix: '' })
    await user.click(option(/preorder/))
    expect(props.onPick).toHaveBeenLastCalledWith({ key: 'product', suffix: 'preorder' })
  })

  it('creates a template in the group it was clicked in', async () => {
    const { props, user } = setup()
    const pages = screen.getByRole('group', { name: copy.names.page })
    await user.click(within(pages).getByRole('option', { name: copy.create }))
    expect(props.onCreate).toHaveBeenCalledWith('page')
    // Only kinds with alternates can create one.
    const home = screen.getByRole('group', { name: copy.names.home })
    expect(within(home).queryByRole('option', { name: copy.create })).toBeNull()
  })

  it('filters by the search and says when nothing matches', async () => {
    const { user } = setup()
    const search = screen.getByPlaceholderText(copy.search)
    await user.type(search, 'preorder')
    expect(option(/preorder/)).toBeTruthy()
    expect(screen.queryByRole('option', { name: copy.names.home })).toBeNull()
    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByText(copy.empty)).toBeTruthy()
  })

  it('runs an alternate action from its menu without picking the row', async () => {
    const { props, user } = setup()
    const name = copy.alternate(copy.names.product, 'preorder')
    await user.click(screen.getByRole('button', { name: copy.manage(name) }))
    await user.click(await screen.findByRole('menuitem', { name: copy.duplicate }))
    expect(props.manager.duplicate).toHaveBeenCalledWith('product', 'preorder')
    expect(props.onAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: copy.manage(name) }))
    await user.click(await screen.findByRole('menuitem', { name: copy.rename }))
    expect(props.manager.setPending).toHaveBeenCalledWith({
      action: 'rename',
      kind: 'product',
      suffix: 'preorder',
    })
    expect(props.onPick).not.toHaveBeenCalled()
  })

  it('offers New page and the keys in the top bar popover, not in the Pages panel', async () => {
    const { props, user } = setup()
    await user.click(option(customizeContent.panels.newPage))
    expect(props.onCreate).toHaveBeenCalledWith('page')
    expect(screen.getByText(copy.keys.move)).toBeTruthy()
  })

  it('leaves New page to the Pages panel head when it fills the panel', () => {
    setup({ fill: true })
    expect(screen.queryByRole('option', { name: customizeContent.panels.newPage })).toBeNull()
    expect(screen.queryByText(copy.keys.move)).toBeNull()
  })
})
