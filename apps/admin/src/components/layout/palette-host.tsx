'use client'

import { useEffect, useState } from 'react'
import { isTyping, OPEN_PALETTE_EVENT } from '@/lib/palette-events'
import CommandPalette from './command-palette'

/**
 * Owns the command palette for the whole admin: ⌘K / Ctrl+K toggles it, "/" opens it
 * when no field has focus (Saleor's "Search /"), and the sidebar and phone bar open it
 * through `openPalette()`.
 */
export default function PaletteHost() {
  // Hooks
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  return <CommandPalette open={open} onOpenChange={setOpen} />
}
