'use client'

import { useEffect } from 'react'
import { MAIN_ZONE } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select'])

/**
 * The one shortcut Puck 0.23 doesn't wire up itself: Cmd/Ctrl+D duplicates the
 * selected section. Delete, Backspace, undo and redo are Puck's own global
 * hotkeys and need nothing from us. Renders nothing; mounted once inside
 * `<Puck>` so it can dispatch through the same store as the tree and overlay.
 */
export default function CustomizeHotkeys() {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const selector = useCustomizePuck((s) => s.appState.ui.itemSelector)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'd' || !(e.metaKey || e.ctrlKey)) return
      const target = e.target
      if (target instanceof HTMLElement) {
        if (EDITABLE_TAGS.has(target.tagName.toLowerCase()) || target.isContentEditable) return
      }
      if (!selector) return
      e.preventDefault()
      dispatch({
        type: 'duplicate',
        sourceIndex: selector.index,
        sourceZone: selector.zone ?? MAIN_ZONE,
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, selector])

  // Render logic
  return null
}
