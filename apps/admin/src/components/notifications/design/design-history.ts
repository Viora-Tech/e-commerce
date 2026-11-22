import type { EmailTemplateDesign } from '@commerce/notifications/design'

/**
 * Undo and redo for the email editor. Every change is one step, except typing: changes that
 * carry the same `group` (one block's fields, the subject line) one after another fold into a
 * single step, so Undo takes back a whole edit instead of one letter.
 */

export type DesignHistory = {
  past: EmailTemplateDesign[]
  present: EmailTemplateDesign
  future: EmailTemplateDesign[]
  /** The group of the last change; the next change with the same group joins its step. */
  group: string | null
}

export type DesignHistoryAction =
  /** A design fresh from the server (load, save, reset): history starts again. */
  | { type: 'load'; design: EmailTemplateDesign }
  /** Loading another message: nothing to edit until it arrives. */
  | { type: 'clear' }
  | { type: 'change'; design: EmailTemplateDesign; group?: string | undefined }
  | { type: 'undo' }
  | { type: 'redo' }

/** How many steps Undo can go back. */
export const HISTORY_LIMIT = 50

export function startHistory(design: EmailTemplateDesign): DesignHistory {
  return { past: [], present: design, future: [], group: null }
}

export function historyReducer(
  state: DesignHistory | null,
  action: DesignHistoryAction,
): DesignHistory | null {
  if (action.type === 'load') return startHistory(action.design)
  if (action.type === 'clear') return null
  if (!state) return state
  switch (action.type) {
    case 'change': {
      if (action.design === state.present) return state
      const group = action.group ?? null
      // Same group as the last change: replace the present, keep one undo step.
      if (group !== null && group === state.group && state.past.length > 0) {
        return { ...state, present: action.design, future: [] }
      }
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.design,
        future: [],
        group,
      }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        group: null,
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future: rest, group: null }
    }
  }
}

export function canUndo(state: DesignHistory | null): boolean {
  return Boolean(state && state.past.length > 0)
}

export function canRedo(state: DesignHistory | null): boolean {
  return Boolean(state && state.future.length > 0)
}

/** Whether two designs would save the same thing (Undo back to the saved one is not a change). */
export function sameDesign(a: EmailTemplateDesign | null, b: EmailTemplateDesign | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type ShortcutEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: EventTarget | null
}

/** A field keeps its own Ctrl+Z (undoing typed letters); the editor's undo is for everything else. */
function isTextTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const el = target as HTMLElement
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

/** Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes; null for any other key. */
export function historyShortcut(e: ShortcutEvent): 'undo' | 'redo' | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextTarget(e.target)) return null
  const key = e.key.toLowerCase()
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !e.shiftKey) return 'redo'
  return null
}
