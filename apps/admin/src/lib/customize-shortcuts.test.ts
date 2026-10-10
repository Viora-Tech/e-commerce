import { describe, expect, it } from 'vitest'
import { editorKeyOf, SHORTCUTS } from './customize-shortcuts'

const press = (
  key: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {},
) =>
  editorKeyOf({
    key,
    metaKey: !!mods.meta,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
  })

describe('editorKeyOf', () => {
  it('saves on Ctrl or ⌘ + S, not with Shift or Alt', () => {
    expect(press('s', { ctrl: true })).toBe('save')
    expect(press('S', { meta: true })).toBe('save')
    expect(press('s', { ctrl: true, shift: true })).toBeNull()
    expect(press('s', { ctrl: true, alt: true })).toBeNull()
    expect(press('s')).toBeNull()
  })

  it('opens Add on / and the shortcuts on ?', () => {
    expect(press('/')).toBe('addSection')
    expect(press('?', { shift: true })).toBe('shortcuts')
    expect(press('/', { ctrl: true })).toBeNull()
  })

  it('switches device on 1, 2 and 3 alone', () => {
    expect(press('1')).toBe('desktop')
    expect(press('2')).toBe('tablet')
    expect(press('3')).toBe('mobile')
    expect(press('4')).toBeNull()
    expect(press('1', { ctrl: true })).toBeNull()
    expect(press('1', { shift: true })).toBeNull()
  })
})

describe('SHORTCUTS', () => {
  it('lists each shortcut once, with the platform key filled in', () => {
    const ids = SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SHORTCUTS.find((s) => s.id === 'save')?.keys('⌘')).toBe('⌘ S')
  })
})
