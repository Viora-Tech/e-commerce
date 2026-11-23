import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  HISTORY_LIMIT,
  historyReducer,
  historyShortcut,
  sameDesign,
  startHistory,
} from './design-history'

const base: EmailTemplateDesign = {
  version: 2,
  blocks: [{ id: 'intro', type: 'intro' }],
  removed: [],
}

const withSubject = (subject: string): EmailTemplateDesign => ({ ...base, subject })

describe('Edit design: undo and redo', () => {
  it('undoes and redoes a change', () => {
    let h = historyReducer(startHistory(base), { type: 'change', design: withSubject('A') })
    expect(canUndo(h)).toBe(true)
    h = historyReducer(h, { type: 'undo' })
    expect(h?.present).toBe(base)
    expect(canRedo(h)).toBe(true)
    h = historyReducer(h, { type: 'redo' })
    expect(h?.present.subject).toBe('A')
    expect(canRedo(h)).toBe(false)
  })

  it('folds typing in one group into one step', () => {
    let h = startHistory(base)
    for (const s of ['H', 'He', 'Hel']) {
      h = historyReducer(h, { type: 'change', design: withSubject(s), group: 'subject' }) ?? h
    }
    expect(h.past).toHaveLength(1)
    expect(historyReducer(h, { type: 'undo' })?.present).toBe(base)
  })

  it('starts a new step when the group changes or after an undo', () => {
    let h = startHistory(base)
    h = historyReducer(h, { type: 'change', design: withSubject('a'), group: 'subject' }) ?? h
    h = historyReducer(h, { type: 'change', design: withSubject('b'), group: 'block:x' }) ?? h
    expect(h.past).toHaveLength(2)
    h = historyReducer(h, { type: 'undo' }) ?? h
    h = historyReducer(h, { type: 'change', design: withSubject('c'), group: 'subject' }) ?? h
    expect(h.past).toHaveLength(2)
    expect(h.future).toHaveLength(0)
  })

  it('a new change drops the redo steps', () => {
    let h = historyReducer(startHistory(base), { type: 'change', design: withSubject('A') })
    h = historyReducer(h, { type: 'undo' })
    h = historyReducer(h, { type: 'change', design: withSubject('B') })
    expect(canRedo(h)).toBe(false)
  })

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = startHistory(base)
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      h = historyReducer(h, { type: 'change', design: withSubject(String(i)) }) ?? h
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT)
  })

  it('does nothing with nothing to undo, redo or edit', () => {
    const h = startHistory(base)
    expect(historyReducer(h, { type: 'undo' })).toBe(h)
    expect(historyReducer(h, { type: 'redo' })).toBe(h)
    expect(historyReducer(null, { type: 'undo' })).toBeNull()
    expect(historyReducer(h, { type: 'clear' })).toBeNull()
    expect(historyReducer(h, { type: 'change', design: base })).toBe(h)
  })

  it('load starts history again', () => {
    const h = historyReducer(startHistory(base), { type: 'change', design: withSubject('A') })
    const loaded = historyReducer(h, { type: 'load', design: base })
    expect(canUndo(loaded)).toBe(false)
    expect(loaded?.present).toBe(base)
  })

  it('compares designs by content', () => {
    expect(sameDesign(withSubject('A'), withSubject('A'))).toBe(true)
    expect(sameDesign(withSubject('A'), base)).toBe(false)
  })
})

describe('Edit design: shortcuts', () => {
  const key = (k: string, extra: Partial<Parameters<typeof historyShortcut>[0]> = {}) =>
    historyShortcut({
      key: k,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target: null,
      ...extra,
    })

  it('maps Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and Cmd+Z', () => {
    expect(key('z')).toBe('undo')
    expect(key('Z', { shiftKey: true })).toBe('redo')
    expect(key('y')).toBe('redo')
    expect(key('z', { ctrlKey: false, metaKey: true })).toBe('undo')
  })

  it('leaves other keys and text fields alone', () => {
    expect(key('z', { ctrlKey: false })).toBeNull()
    expect(key('s')).toBeNull()
    expect(key('z', { altKey: true })).toBeNull()
    const input = { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget
    expect(key('z', { target: input })).toBeNull()
  })
})
