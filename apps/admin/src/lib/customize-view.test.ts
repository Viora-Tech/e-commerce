import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PANELS,
  isFullViewShortcut,
  isTypingTarget,
  parsePanelState,
} from './customize-view'

describe('parsePanelState', () => {
  it('reads a stored choice and falls back to both panels open', () => {
    expect(parsePanelState('{"left":false,"right":true}')).toEqual({ left: false, right: true })
    expect(parsePanelState('{"left":false}')).toEqual({ left: false, right: true })
    expect(parsePanelState(null)).toEqual(DEFAULT_PANELS)
    expect(parsePanelState('not json')).toEqual(DEFAULT_PANELS)
    expect(parsePanelState('{"left":"no","right":0}')).toEqual(DEFAULT_PANELS)
  })
})

describe('isFullViewShortcut', () => {
  const key = (
    k: string,
    mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {},
  ) =>
    isFullViewShortcut({
      key: k,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      ...mods,
    })

  it('is backslash alone, or Ctrl/Cmd + full stop', () => {
    expect(key('\\')).toBe(true)
    expect(key('.', { ctrlKey: true })).toBe(true)
    expect(key('.', { metaKey: true })).toBe(true)
  })

  it('ignores other keys and combinations', () => {
    expect(key('.')).toBe(false)
    expect(key('\\', { ctrlKey: true })).toBe(false)
    expect(key('\\', { shiftKey: true })).toBe(false)
    expect(key('.', { ctrlKey: true, altKey: true })).toBe(false)
    expect(key('f')).toBe(false)
  })
})

describe('isTypingTarget', () => {
  it('is a field or editable text, from any window', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
    expect(
      isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true)
    expect(
      isTypingTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget),
    ).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
