'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GO_TO_ROUTES } from '@/data/command-palette'
import { isTyping, OPEN_PALETTE_EVENT } from '@/lib/palette-events'
import { primaryActionHref } from '@/lib/primary-action'
import CommandPalette from './command-palette'
import KeyboardShortcutsDialog from './keyboard-shortcuts-dialog'

const GO_TO_WINDOW_MS = 900

/**
 * Owns the command palette and the admin's global shortcuts: ⌘K / Ctrl+K and "/" open the
 * palette (Saleor's "Search /"); "N" jumps to the current list page's primary "Add …" action
 * (`usePrimaryAction`); "G" then "O"/"P"/"C" jumps straight to Orders, Products or Customers;
 * "?" shows the shortcuts list. All ignored while typing in a field.
 */
export default function PaletteHost() {
  // Hooks
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    let awaitingGoTo = false
    let goToTimer: ReturnType<typeof setTimeout> | undefined

    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      if (awaitingGoTo) {
        awaitingGoTo = false
        clearTimeout(goToTimer)
        const href = GO_TO_ROUTES[e.key.toLowerCase()]
        if (href) {
          e.preventDefault()
          router.push(href)
        }
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key.toLowerCase() === 'n') {
        const href = primaryActionHref()
        if (href) {
          e.preventDefault()
          router.push(href)
        }
        return
      }
      if (e.key.toLowerCase() === 'g') {
        awaitingGoTo = true
        goToTimer = setTimeout(() => {
          awaitingGoTo = false
        }, GO_TO_WINDOW_MS)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      clearTimeout(goToTimer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [router])

  return (
    <>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
