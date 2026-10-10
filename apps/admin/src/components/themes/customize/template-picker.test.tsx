// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import TemplatePicker, { templateLabel } from './template-picker'

const copy = customizeContent.templates

// The manager talks to the API; the picker only needs its surface.
const manager = {
  busy: false,
  refresh: vi.fn(),
  usedBy: () => 0,
  duplicate: vi.fn(async () => undefined),
  setPending: vi.fn(),
  pending: null,
}
vi.mock('@/lib/use-template-manager', () => ({ useTemplateManager: () => manager }))
vi.mock('./template-manager-dialogs', () => ({ default: () => null }))

function setup(overrides: Partial<Parameters<typeof TemplatePicker>[0]> = {}) {
  const props = {
    themeId: 'theme-1',
    value: { key: 'product' as const, suffix: 'preorder' },
    alternates: [{ template: 'product', suffix: 'preorder' }],
    onChange: vi.fn(),
    onCreate: vi.fn(),
    onManaged: vi.fn(),
    ...overrides,
  }
  render(<TemplatePicker {...props} />)
  return { props, user: userEvent.setup() }
}

beforeEach(() => {
  manager.busy = false
  manager.refresh.mockClear()
})

describe('templateLabel', () => {
  it('names the default template by its kind and an alternate with its suffix', () => {
    expect(templateLabel({ key: 'home', suffix: '' })).toBe(copy.names.home)
    expect(templateLabel({ key: 'product', suffix: 'preorder' })).toBe(
      copy.alternate(copy.names.product, 'preorder'),
    )
  })
})

describe('TemplatePicker', () => {
  it('shows the open template on its trigger', () => {
    setup()
    expect(screen.getByRole('button', { name: copy.label }).textContent).toContain(
      copy.alternate(copy.names.product, 'preorder'),
    )
  })

  it('refreshes usage counts when opened and closes after a pick', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: copy.label }))
    expect(manager.refresh).toHaveBeenCalledTimes(1)
    await user.click(await screen.findByRole('option', { name: copy.names.home }))
    expect(props.onChange).toHaveBeenCalledWith({ key: 'home', suffix: '' })
    expect(screen.queryByRole('option', { name: copy.names.home })).toBeNull()
  })

  it('hands "Create template" to the host with the kind it was clicked in', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: copy.label }))
    const creates = await screen.findAllByRole('option', { name: copy.create })
    await user.click(creates[0] as HTMLElement)
    expect(props.onCreate).toHaveBeenCalledWith('product')
  })

  it('shows a spinner instead of the home glyph while a switch is in flight', () => {
    setup({ loading: true })
    expect(
      screen.getByRole('button', { name: copy.label }).querySelector('.animate-spin'),
    ).not.toBeNull()
  })
})
