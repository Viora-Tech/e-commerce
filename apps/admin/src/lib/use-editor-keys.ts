'use client'

import { useEffect } from 'react'
import { type EditorKey, editorKeyOf } from './customize-shortcuts'
import { isTypingTarget } from './customize-view'

/**
 * Calls `onKey` for the editor-level shortcuts (`editorKeyOf`) pressed in the admin or inside the
 * canvas frame, never while typing. The frame swaps its document when it loads, so its listener
 * is attached again on every load.
 */
export function useEditorKeys(onKey: (key: EditorKey, e: KeyboardEvent) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return
      const key = editorKeyOf(e)
      if (key) onKey(key, e)
    }
    const iframe = document.querySelector('iframe')
    let frameDoc: Document | null = null
    const attachFrame = () => {
      frameDoc?.removeEventListener('keydown', handleKeyDown)
      frameDoc = iframe?.contentDocument ?? null
      frameDoc?.addEventListener('keydown', handleKeyDown)
    }
    document.addEventListener('keydown', handleKeyDown)
    attachFrame()
    iframe?.addEventListener('load', attachFrame)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      frameDoc?.removeEventListener('keydown', handleKeyDown)
      iframe?.removeEventListener('load', attachFrame)
    }
  }, [onKey])
}
