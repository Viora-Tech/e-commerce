// @vitest-environment jsdom
import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emailDesignContent as copy } from '@/data/email-design'
import DesignEditorSidebar from './design-editor-sidebar'
import DesignSettingsPanel from './design-settings-panel'
import { removeBlock } from './design-state'

vi.mock('@/lib/api-client', () => ({ api: {} }))
vi.mock('@/components/media/media-pick-dialog', () => ({ default: () => null }))
vi.mock('@/components/growth/campaigns/visual-builder/builder-link-dialog', () => ({
  default: () => null,
}))

const design: EmailTemplateDesign = {
  version: 2,
  blocks: [
    { id: 'logo', type: 'logo', menu: true },
    { id: 'intro', type: 'intro' },
    { id: 'items#0', type: 'slot', slot: 'items#0' },
    { id: 'text#0', type: 'slot', slot: 'text#0' },
    { id: 'hello', type: 'text', text: 'Hello {{nope}}', align: 'center', muted: false },
  ],
  removed: [],
}

function setup(selected: string | null = null) {
  const onChange = vi.fn()
  render(
    <DesignEditorSidebar
      design={design}
      variables={['customer_name']}
      selected={selected}
      onSelect={vi.fn()}
      onChange={onChange}
    />,
  )
  return onChange
}

describe('Edit design: locked blocks', () => {
  it('shows a lock and no remove button on the order blocks and the intro', () => {
    setup()
    expect(
      screen.queryByRole('button', { name: copy.editor.remove(copy.slots.items as string) }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: copy.editor.remove(copy.blocks.intro) })).toBeNull()
    expect(screen.getAllByTestId('block-locked')).toHaveLength(2)
    // A plain built-in line and the merchant's own blocks can go.
    expect(
      screen.getByRole('button', { name: copy.editor.remove(copy.slots.text as string) }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: copy.editor.remove(copy.blocks.logo) })).toBeTruthy()
  })

  it('removes a free block and remembers a removed built-in line', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.editor.remove(copy.blocks.text) }))
    const next = onChange.mock.calls[0]?.[0] as EmailTemplateDesign
    expect(next.blocks.map((b) => b.id)).not.toContain('hello')
    fireEvent.click(
      screen.getByRole('button', { name: copy.editor.remove(copy.slots.text as string) }),
    )
    const after = onChange.mock.calls[1]?.[0] as EmailTemplateDesign
    expect(after.removed).toEqual(['text#0'])
  })

  it('never removes a locked block, even when asked directly', () => {
    expect(removeBlock(design, 'items#0')).toBe(design)
    expect(removeBlock(design, 'intro')).toBe(design)
  })

  it('duplicates a free block below it, but never an order block or the intro', () => {
    const onChange = setup()
    expect(
      screen.queryByRole('button', { name: copy.editor.duplicate(copy.slots.items as string) }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: copy.editor.duplicate(copy.blocks.intro) }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: copy.editor.duplicate(copy.blocks.text) }))
    const next = onChange.mock.calls[0]?.[0] as EmailTemplateDesign
    expect(next.blocks).toHaveLength(design.blocks.length + 1)
    expect(next.blocks.at(-1)).toMatchObject({ type: 'text', text: 'Hello {{nope}}' })
  })

  it('adds a block from the palette with a click (Enter from the keyboard)', () => {
    const onChange = setup('logo')
    fireEvent.click(screen.getByRole('button', { name: copy.blocks.heading }))
    const next = onChange.mock.calls[0]?.[0] as EmailTemplateDesign
    expect(next.blocks[1]?.type).toBe('heading')
  })

  it('flags a word this email cannot fill in', () => {
    render(
      <DesignSettingsPanel
        design={design}
        variables={['customer_name']}
        selected="hello"
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe(copy.variables.unknown('{{nope}}'))
  })
})
