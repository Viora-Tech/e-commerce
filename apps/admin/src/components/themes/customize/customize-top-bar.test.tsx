// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import CustomizeTopBar from './customize-top-bar'

const copy = customizeContent.bar

vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: unknown) => unknown) =>
    select({ history: { back: vi.fn(), forward: vi.fn(), hasPast: false, hasFuture: false } }),
}))
vi.mock('@/components/layout/user-menu', () => ({ default: () => null }))
vi.mock('./zoom-menu', () => ({ default: () => null }))

function setup(props: Partial<ComponentProps<typeof CustomizeTopBar>>) {
  const handlers = {
    onSave: vi.fn(),
    onPublish: vi.fn(),
    onDiscard: vi.fn(),
    onDevice: vi.fn(),
    onVersions: vi.fn(),
  }
  render(
    <CustomizeTopBar
      name="Copy of Waimers"
      live={false}
      dirty={false}
      saving={false}
      publishing={false}
      canPublish
      device="desktop"
      previewHref="/preview"
      codeHref="/code"
      modeSwitch={null}
      pickers={null}
      aiConnected={false}
      user={{ name: 'Owner', email: 'owner@example.com' }}
      {...handlers}
      {...props}
    />,
  )
  return { ...handlers, user: userEvent.setup() }
}

const button = (name: string) => screen.queryByRole('button', { name })

describe('CustomizeTopBar: Save and Publish (Figma 369:126247)', () => {
  it('shows Publish alone when a draft theme has nothing unsaved', () => {
    setup({})
    expect(button(copy.save)).toBeNull()
    expect(button(copy.publish)).toBeTruthy()
    expect(screen.getByText(themesContent.editor.draft)).toBeTruthy()
  })

  it('puts Save beside Publish on a draft theme with changes, and the chip says so', async () => {
    const { onSave, onPublish, user } = setup({ dirty: true })
    expect(screen.getAllByText(copy.unsaved).length).toBeGreaterThan(0)
    await user.click(button(copy.save) as HTMLElement)
    expect(onSave).toHaveBeenCalled()
    await user.click(button(copy.publish) as HTMLElement)
    expect(onPublish).toHaveBeenCalled()
  })

  it('on the live theme one Save commits the changes, with no Publish', async () => {
    const { onSave, onPublish, user } = setup({ live: true, dirty: true })
    expect(button(copy.publish)).toBeNull()
    await user.click(button(copy.save) as HTMLElement)
    expect(onSave).toHaveBeenCalled()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('hides Publish from members who may not publish', () => {
    setup({ canPublish: false, dirty: true })
    expect(button(copy.publish)).toBeNull()
    expect(button(copy.save)).toBeTruthy()
  })

  it('saves on Ctrl/⌘ + S only when something changed, and switches device on 1 2 3', () => {
    const clean = setup({})
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
    )
    expect(clean.onSave).not.toHaveBeenCalled()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    expect(clean.onDevice).toHaveBeenCalledWith('mobile')
  })

  it('saves on Ctrl/⌘ + S with changes', () => {
    const { onSave } = setup({ dirty: true })
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    )
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
