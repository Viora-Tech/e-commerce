'use client'

import { useEffect } from 'react'

/** How long the page counts as "just toggled from the keyboard", longer than the rail's motion. */
const INSTANT_MS = 400

/**
 * Cmd/Ctrl+B is a frequent keyboard action, so the rail snaps instead of animating: for a
 * moment after the shortcut the root carries `data-sidebar-instant`, which the rail's
 * motion classes (lib/sidebar-motion.ts) read. The toggle button still animates.
 */
export default function SidebarShortcutGuard() {
  // Hooks
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'b' || !(event.metaKey || event.ctrlKey)) return
      const root = document.documentElement
      root.setAttribute('data-sidebar-instant', '')
      clearTimeout(timer)
      timer = setTimeout(() => root.removeAttribute('data-sidebar-instant'), INSTANT_MS)
    }
    // Capture phase: the attribute must be set before the provider's own handler toggles.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      clearTimeout(timer)
    }
  }, [])

  return null
}
