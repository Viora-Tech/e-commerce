// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomizeHotkeys from './customize-hotkeys'

const dispatch = vi.fn()
const puck = {
  dispatch,
  appState: {
    ui: { itemSelector: { index: 0, zone: 'root:default-zone' } as unknown },
    data: { root: { props: {} }, content: [], zones: {} },
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))
vi.mock('@puckeditor/core', async (original) => ({
  ...(await original<typeof import('@puckeditor/core')>()),
  useGetPuck: () => () => puck,
}))

const press = (target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

let inspector: HTMLElement
beforeEach(() => {
  dispatch.mockClear()
  inspector = document.createElement('aside')
  inspector.setAttribute('data-inspector', '')
  document.body.append(inspector)
})
afterEach(() => {
  document.body.replaceChildren()
})

describe('CustomizeHotkeys: Escape', () => {
  it('deselects, back to the empty right panel', () => {
    render(<CustomizeHotkeys />)
    press()
    expect(dispatch).toHaveBeenCalledWith({ type: 'setUi', ui: { itemSelector: null } })
  })

  it('leaves the selection alone while the right panel is hidden (full view owns Esc)', () => {
    inspector.hidden = true
    render(<CustomizeHotkeys />)
    press()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('leaves an open menu or dialog to close itself', () => {
    render(<CustomizeHotkeys />)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const button = document.createElement('button')
    dialog.append(button)
    document.body.append(dialog)
    press(button)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does nothing while typing', () => {
    render(<CustomizeHotkeys />)
    const input = document.createElement('input')
    document.body.append(input)
    press(input)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
