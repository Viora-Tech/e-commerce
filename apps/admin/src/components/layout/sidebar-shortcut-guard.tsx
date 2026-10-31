'use client'

import { useEffect } from 'react'

/** How long the page counts as "just toggled from the keyboard", longer than the rail's motion. */
const INSTANT_MS = 400

const isToggleKey = (event: KeyboardEvent) =>
  event.key?.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey)

/** Typing in a field or rich-text editor: there Cmd/Ctrl+B means bold, not "toggle the rail". */
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]') !== null)

/**
 * Cmd/Ctrl+B is a frequent keyboard action, so the rail snaps instead of animating: for a
 * moment after the shortcut the root carries `data-sidebar-instant`, which the rail's
 * motion classes (lib/sidebar-motion.ts) read. The toggle button still animates.
 *
 * Inside a field the shortcut is left to the field (bold in the blog, page and product
 * editors): the sidebar provider listens on `window`, so stopping the key at `document`, after
 * the editor has handled it, keeps the rail where it is.
 */
export default function SidebarShortcutGuard() {
  // Hooks
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isToggleKey(event) || isEditable(event.target)) return
      const root = document.documentElement
      root.setAttribute('data-sidebar-instant', '')
      clearTimeout(timer)
      timer = setTimeout(() => root.removeAttribute('data-sidebar-instant'), INSTANT_MS)
    }
    const handleFieldKey = (event: KeyboardEvent) => {
      if (isToggleKey(event) && isEditable(event.target)) event.stopPropagation()
    }
    // Capture phase: the attribute must be set before the provider's own handler toggles.
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleFieldKey)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleFieldKey)
      clearTimeout(timer)
    }
  }, [])

  return null
}
