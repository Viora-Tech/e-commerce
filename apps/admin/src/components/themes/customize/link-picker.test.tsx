// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import type { LinkTarget } from '@/lib/customize-links'
import LinkPicker from './link-picker'

const copy = customizeContent.link

const MOUSE: LinkTarget = {
  kind: 'product',
  id: 'p1',
  title: 'Viper mouse',
  href: '/products/viper',
}
const MICE: LinkTarget = {
  kind: 'collection',
  id: 'c1',
  title: 'All mice',
  href: '/collections/mice',
}

// The store's link targets come from the API; recent picks from localStorage.
const targets = vi.hoisted(() => ({
  findLinkTarget: vi.fn(),
  searchLinkTargets: vi.fn(),
  searchAllLinkTargets: vi.fn(),
  readRecentLinks: vi.fn(() => []),
  rememberLink: vi.fn(),
}))
vi.mock('@/lib/customize-link-targets', () => targets)
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

function setup(props: Partial<Parameters<typeof LinkPicker>[0]> = {}) {
  const onChange = vi.fn()
  render(<LinkPicker value="" onChange={onChange} {...props} />)
  return { onChange, user: userEvent.setup() }
}

const openPicker = async (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) => {
  await user.click(screen.getByRole('button', { name }))
  return screen.findByPlaceholderText(copy.search)
}

beforeEach(() => {
  for (const fn of Object.values(targets)) fn.mockReset()
  targets.readRecentLinks.mockReturnValue([])
  targets.findLinkTarget.mockResolvedValue(null)
  targets.searchLinkTargets.mockResolvedValue([MOUSE])
  targets.searchAllLinkTargets.mockResolvedValue([
    { kind: 'product', items: [MOUSE] },
    { kind: 'collection', items: [MICE] },
  ])
})

describe('LinkPicker', () => {
  it('shows a placeholder and no clear button while empty', () => {
    setup()
    expect(screen.getByRole('button', { name: copy.open }).textContent).toContain(copy.placeholder)
    expect(screen.queryByRole('button', { name: copy.clear })).toBeNull()
  })

  it("shows a stored link as a chip with its target's title and kind", async () => {
    targets.findLinkTarget.mockResolvedValue(MOUSE)
    setup({ value: '/products/viper' })
    expect(targets.findLinkTarget).toHaveBeenCalledWith('product', 'viper', '/products/viper')
    expect(
      await screen.findByRole('button', {
        name: `${copy.open}: Viper mouse, ${copy.kinds.product}`,
      }),
    ).toBeTruthy()
  })

  it('shows a web address without its scheme and clears it', async () => {
    const { onChange, user } = setup({ value: 'https://example.com/x' })
    expect(
      screen.getByRole('button', { name: `${copy.open}: example.com/x, ${copy.kinds.url}` }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: copy.clear }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('picks the home page from the browse list and remembers it', async () => {
    const { onChange, user } = setup()
    await openPicker(user, copy.open)
    await user.click(screen.getByRole('button', { name: new RegExp(copy.home) }))
    expect(onChange).toHaveBeenCalledWith('/')
    expect(targets.rememberLink).toHaveBeenCalledWith(null, {
      href: '/',
      title: copy.home,
      kind: 'home',
    })
    await waitFor(() => expect(screen.queryByPlaceholderText(copy.search)).toBeNull())
  })

  it('searches every kind at once and picks a result', async () => {
    const { onChange, user } = setup()
    const search = await openPicker(user, copy.open)
    await user.type(search, 'mi')
    expect(await screen.findByRole('button', { name: /All mice/ })).toBeTruthy()
    expect(targets.searchAllLinkTargets).toHaveBeenLastCalledWith('mi')
    await user.click(screen.getByRole('button', { name: /Viper mouse/ }))
    expect(onChange).toHaveBeenCalledWith('/products/viper')
  })

  it('drills into one kind with its own search and back out', async () => {
    const { user } = setup()
    await openPicker(user, copy.open)
    await user.click(screen.getByRole('button', { name: copy.tabs.product }))
    expect(await screen.findByRole('button', { name: /Viper mouse/ })).toBeTruthy()
    expect(targets.searchLinkTargets).toHaveBeenCalledWith('product', '')
    expect(screen.getByPlaceholderText(copy.searchIn(copy.tabs.product))).toBeTruthy()
    await user.click(screen.getByRole('button', { name: copy.back }))
    expect(screen.getByPlaceholderText(copy.search)).toBeTruthy()
  })

  it('says when a search finds nothing, and when it fails', async () => {
    targets.searchAllLinkTargets.mockResolvedValueOnce([{ kind: 'product', items: [] }])
    const { user } = setup()
    const search = await openPicker(user, copy.open)
    await user.type(search, 'zz')
    expect(await screen.findByText(copy.empty)).toBeTruthy()
    targets.searchAllLinkTargets.mockRejectedValueOnce(new Error('offline'))
    await user.type(search, 'z')
    expect(await screen.findByText(copy.failed)).toBeTruthy()
  })

  it('offers a typed web address as a link of its own', async () => {
    const { onChange, user } = setup()
    const search = await openPicker(user, copy.open)
    await user.type(search, 'example.com')
    await user.click(await screen.findByRole('button', { name: /https:\/\/example\.com/ }))
    expect(onChange).toHaveBeenCalledWith('https://example.com/')
  })

  it('refuses an unsafe pasted link and keeps a safe one', async () => {
    const { onChange, user } = setup()
    await openPicker(user, copy.open)
    const paste = screen.getByLabelText(copy.pasteHeading)
    await user.type(paste, 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: copy.pasteApply }))
    expect(screen.getByText(copy.pasteInvalid)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(paste)
    await user.type(paste, '/pages/about{Enter}')
    expect(onChange).toHaveBeenCalledWith('/pages/about')
  })

  it('shows the new-tab switch only for fields that can store it', async () => {
    const onNewTab = vi.fn()
    const { user } = setup({ value: '/', newTab: false, onNewTab })
    await openPicker(user, new RegExp(copy.open))
    await user.click(screen.getByRole('switch', { name: copy.newTab }))
    expect(onNewTab).toHaveBeenCalledWith(true)
  })

  it('cannot be opened or cleared when read-only', () => {
    setup({ value: '/', readOnly: true })
    expect(
      screen.getByRole('button', { name: new RegExp(copy.open) }).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('button', { name: copy.clear })).toBeNull()
  })
})
