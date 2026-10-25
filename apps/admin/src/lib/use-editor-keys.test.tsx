// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorKey } from './customize-shortcuts'
import { useEditorKeys } from './use-editor-keys'

function Probe({ onKey }: { onKey: (key: EditorKey) => void }) {
  useEditorKeys((key) => onKey(key))
  return null
}

const press = (key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))

afterEach(() => {
  document.body.replaceChildren()
})

describe('useEditorKeys', () => {
  it('reports the editor shortcuts pressed in the admin', () => {
    const onKey = vi.fn()
    render(<Probe onKey={onKey} />)
    press('/')
    press('s', document.body, { ctrlKey: true })
    press('2')
    expect(onKey.mock.calls.map(([k]) => k)).toEqual(['addSection', 'save', 'tablet'])
  })

  it('ignores keys typed into a field and other keys', () => {
    const onKey = vi.fn()
    render(<Probe onKey={onKey} />)
    const input = document.createElement('input')
    document.body.append(input)
    press('/', input)
    press('x')
    expect(onKey).not.toHaveBeenCalled()
  })
})
