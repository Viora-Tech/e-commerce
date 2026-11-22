'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Copy text to the clipboard and remember it worked for a moment (the button's tick). The one
 * clipboard helper (owner, 22 Nov 2026); the caller says it with a toast or a label. False when
 * the browser blocks the clipboard.
 */
export function useClipboard(resetMs = 1500) {
  // Hooks
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Helpers
  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    setDone(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), resetMs)
    return true
  }

  return { done, copyText }
}
