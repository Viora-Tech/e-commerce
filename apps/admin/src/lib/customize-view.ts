'use client'

import { createContext, useContext, useEffect, useState } from 'react'

/**
 * How much of the editor shows: the left panel, the right panel, and full view (the page alone,
 * rail and both panels hidden). The two panels are remembered in this browser (`localStorage`),
 * so each member's editor opens the way they left it; full view is never remembered.
 */
export type PanelState = { left: boolean; right: boolean }

export const DEFAULT_PANELS: PanelState = { left: true, right: true }

const STORAGE_KEY = 'customize.panels.v1'

/** A stored value read defensively (it comes from localStorage): anything odd is the default. */
export function parsePanelState(raw: string | null): PanelState {
  if (!raw) return DEFAULT_PANELS
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof PanelState, unknown>>
    return {
      left: typeof v.left === 'boolean' ? v.left : true,
      right: typeof v.right === 'boolean' ? v.right : true,
    }
  } catch {
    return DEFAULT_PANELS
  }
}

export type EditorView = PanelState & {
  full: boolean
  setLeft: (open: boolean) => void
  setRight: (open: boolean) => void
  setFull: (full: boolean) => void
}

export const EditorViewContext = createContext<EditorView>({
  ...DEFAULT_PANELS,
  full: false,
  setLeft: () => undefined,
  setRight: () => undefined,
  setFull: () => undefined,
})

export const useEditorView = (): EditorView => useContext(EditorViewContext)

/** The editor's view state, for `CustomizeLayout` to provide. */
export function useEditorViewState(): EditorView {
  // Read after mount: the server render cannot know the browser's choice.
  const [panels, setPanels] = useState<PanelState>(DEFAULT_PANELS)
  const [full, setFull] = useState(false)
  useEffect(() => {
    try {
      setPanels(parsePanelState(window.localStorage.getItem(STORAGE_KEY)))
    } catch {
      // Storage blocked: the default panels.
    }
  }, [])

  const save = (next: PanelState) => {
    setPanels(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }

  return {
    ...panels,
    full,
    setLeft: (open) => save({ ...panels, left: open }),
    setRight: (open) => save({ ...panels, right: open }),
    setFull,
  }
}

/**
 * The full-view shortcut: `\` on its own, or Ctrl/⌘ + `.` (the key next to it on many
 * keyboards); never while typing in a field.
 */
export function isFullViewShortcut(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
): boolean {
  if (e.altKey || e.shiftKey) return false
  if (e.key === '\\') return !e.metaKey && !e.ctrlKey
  return e.key === '.' && (e.metaKey || e.ctrlKey)
}

const TYPING_TAGS = new Set(['input', 'textarea', 'select'])

/**
 * A key pressed while typing (a field, or text being edited on the canvas) is the text's, not a
 * shortcut. Duck-typed, since events from the canvas frame come from another window's elements.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null
  if (!el || typeof el.tagName !== 'string') return false
  return TYPING_TAGS.has(el.tagName.toLowerCase()) || el.isContentEditable === true
}
