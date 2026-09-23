'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const BEACON_PATH = '/api/beacon'

/**
 * Sends one page-view beacon per navigation with the page URL and the
 * document referrer, so the server can tell where a session came from.
 * Nothing is read back.
 */
export default function VisitBeacon() {
  // Hooks
  const pathname = usePathname()

  // One beacon per navigation: the pathname is the trigger, not an input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every route change
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const body = JSON.stringify({ href: window.location.href, referrer: document.referrer })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(BEACON_PATH, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(BEACON_PATH, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body,
    })
  }, [pathname])

  // Render logic
  return null
}
