'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GO_TO_ROUTES } from '@/data/command-palette'
import { isTyping, OPEN_PALETTE_EVENT } from '@/lib/palette-events'
import { primaryActionHref } from '@/lib/primary-action'

/* The palette (its search index and settings search) and the shortcuts list load on first use,
   not with every admin page; once loaded they stay mounted so closing still animates. */
const CommandPalette = dynamic(() => import('./command-palette'), { ssr: false })
const KeyboardShortcutsDialog = dynamic(() => import('./keyboard-shortcuts-dialog'), { ssr: false })

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
  const [used, setUsed] = useState({ palette: false, shortcuts: false })

  // Keep a dialog mounted after its first opening (its close animation needs it there).
  useEffect(() => {
    if (open || shortcutsOpen) {
      setUsed((u) => ({ palette: u.palette || open, shortcuts: u.shortcuts || shortcutsOpen }))
    }
  }, [open, shortcutsOpen])

  useEffect(() => {
    let awaitingGoTo = false
    let goToTimer: ReturnType<typeof setTimeout> | undefined

    function onKey(e: KeyboardEvent) {
      // Chrome's autofill sends keydown events with no key.
      if (!e.key) return
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (e.repeat) return
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
      {open || used.palette ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
      {shortcutsOpen || used.shortcuts ? (
        <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      ) : null}
    </>
  )
}
