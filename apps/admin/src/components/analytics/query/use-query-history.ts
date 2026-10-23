'use client'

import { useState } from 'react'

/** Undo / redo for the query text: typing, control edits, Format and AI answers. */
export type QueryHistory = {
  past: string[]
  present: string
  future: string[]
  /** When the present text was recorded, so a burst of typing is one step. */
  at: number
  kind: 'typing' | 'edit'
}

export const HISTORY_MAX = 100
/** Keystrokes closer together than this undo as one step. */
export const TYPING_MERGE_MS = 800

export const startHistory = (text: string): QueryHistory => ({
  past: [],
  present: text,
  future: [],
  at: 0,
  kind: 'edit',
})

export function record(
  h: QueryHistory,
  next: string,
  kind: QueryHistory['kind'],
  now: number,
): QueryHistory {
  if (next === h.present) return h
  if (kind === 'typing' && h.kind === 'typing' && now - h.at < TYPING_MERGE_MS) {
    return { ...h, present: next, future: [], at: now }
  }
  return {
    past: [...h.past, h.present].slice(-HISTORY_MAX),
    present: next,
    future: [],
    at: now,
    kind,
  }
}

export function undo(h: QueryHistory): QueryHistory {
  const previous = h.past.at(-1)
  if (previous === undefined) return h
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
    at: 0,
    kind: 'edit',
  }
}

export function redo(h: QueryHistory): QueryHistory {
  const [next, ...rest] = h.future
  if (next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: rest, at: 0, kind: 'edit' }
}

/** The editor's text with its history; `type` merges keystrokes, `replace` is one step. */
export function useQueryHistory(initial: string) {
  // Hooks
  const [history, setHistory] = useState(() => startHistory(initial))

  return {
    text: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    type: (next: string) => setHistory((h) => record(h, next, 'typing', Date.now())),
    replace: (next: string) => setHistory((h) => record(h, next, 'edit', Date.now())),
    /** Steps back and returns the text it lands on, so the caller can check and run it. */
    undo: () => {
      const next = undo(history)
      setHistory(next)
      return next.present
    },
    redo: () => {
      const next = redo(history)
      setHistory(next)
      return next.present
    },
  }
}
