'use client'

import { useEffect } from 'react'
import { keepPendingReferral, takePendingReferral } from '@/lib/referral-pending'

/** This tab's session storage, or null where the browser blocks it. */
function tabStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * The affiliate referral cookie waits for a yes to marketing cookies (owner, 12 Nov 2026).
 * Until then an affiliate link's landing is kept in the tab; on the yes it goes to
 * `/api/referral` once, which sets the cookie dated at the click. Without a yes it never leaves
 * the browser, and closing the tab forgets it.
 */
export function usePendingReferral(marketing: boolean): void {
  useEffect(() => {
    const storage = tabStorage()
    if (!marketing) {
      keepPendingReferral(storage, window.location.search, new Date())
      return
    }
    const pending = takePendingReferral(storage)
    if (!pending) return
    void fetch('/api/referral', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pending),
      keepalive: true,
    }).catch(() => undefined)
  }, [marketing])
}
