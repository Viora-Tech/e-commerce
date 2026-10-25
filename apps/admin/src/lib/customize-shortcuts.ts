/**
 * SOURCE OF TRUTH KEYWORDS: editor shortcuts, keyboard shortcuts dialog, help panel keys
 * WHAT:  Every keyboard shortcut of the theme editor, as the Help panel and the shortcuts
 *        dialog list them (Figma 381:8563, 392:10617), and the editor-level keys this module
 *        itself recognises: save, add section, the shortcuts dialog and the three devices.
 * WHY:   One list, so the panel, the dialog and the handlers can't drift apart. Selection keys
 *        (duplicate, copy, paste, hide, move, remove, deselect) live in `customize-hotkeys.tsx`,
 *        undo/redo are Puck's, full view is `full-view-exit.tsx`.
 */

export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'save'
  | 'addSection'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'hide'
  | 'move'
  | 'remove'
  | 'deselect'
  | 'device'
  | 'fullView'
  | 'shortcuts'

/** The keys to press for each shortcut, as shown; `mod` is ⌘ on a Mac and Ctrl elsewhere. */
export const SHORTCUTS: { id: ShortcutId; keys: (mod: string) => string }[] = [
  { id: 'undo', keys: (mod) => `${mod} Z` },
  { id: 'redo', keys: (mod) => `${mod} ⇧ Z` },
  { id: 'save', keys: (mod) => `${mod} S` },
  { id: 'addSection', keys: () => '/' },
  { id: 'duplicate', keys: (mod) => `${mod} D` },
  { id: 'copy', keys: (mod) => `${mod} C` },
  { id: 'paste', keys: (mod) => `${mod} V` },
  { id: 'hide', keys: (mod) => `${mod} ⇧ H` },
  { id: 'move', keys: () => 'Alt ↑ ↓' },
  { id: 'remove', keys: () => 'Delete' },
  { id: 'deselect', keys: () => 'Esc' },
  { id: 'device', keys: () => '1 2 3' },
  { id: 'fullView', keys: () => '\\' },
  { id: 'shortcuts', keys: () => '?' },
]

export type EditorKey = 'save' | 'addSection' | 'shortcuts' | 'desktop' | 'tablet' | 'mobile'

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

const DEVICE_KEYS: Record<string, EditorKey> = { '1': 'desktop', '2': 'tablet', '3': 'mobile' }

/** Which editor-level shortcut a key press is, if any. Callers skip presses made while typing. */
export function editorKeyOf(e: KeyLike): EditorKey | null {
  const mod = e.metaKey || e.ctrlKey
  if (e.altKey) return null
  if (mod) return !e.shiftKey && e.key.toLowerCase() === 's' ? 'save' : null
  if (e.key === '/') return 'addSection'
  if (e.key === '?') return 'shortcuts'
  return e.shiftKey ? null : (DEVICE_KEYS[e.key] ?? null)
}
