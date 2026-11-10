'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

type VisitBeaconProps = {
  /** True after a yes to analytics; flipping it sends the page again with cookies and source. */
  consented: boolean
}

const BEACON_PATH = '/api/beacon'

/**
 * Sends one page-view beacon per navigation with the page URL and the
 * document referrer, so the server can tell where a session came from.
 * Without a yes to analytics the server counts the visit cookieless (totals
 * only). Nothing is read back.
 */
export default function VisitBeacon({ consented }: VisitBeaconProps) {
  // Hooks
  const pathname = usePathname()

  // One beacon per navigation, and again on a yes: pathname and consent are triggers, not inputs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every route change and consent change
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
  }, [pathname, consented])

  // Render logic
  return null
}
