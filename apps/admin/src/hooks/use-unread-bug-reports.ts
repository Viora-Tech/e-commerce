'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { BUG_REPORTS_SEEN_EVENT } from '@/lib/bug-report-events'

/** Re-asked this often while the tab is visible: status changes arrive from GitHub any time. */
const POLL_MS = 5 * 60_000

/**
 * How many of the member's bug reports changed since they last opened My reports (the account
 * menu's dot). 0 while `enabled` is false (bug reports off) and whenever the call fails.
 */
export function useUnreadBugReports(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      api.bugReports
        .unreadCount()
        .then((r) => {
          if (live) setCount(r.count)
        })
        .catch(() => undefined)
    }
    const clear = () => setCount(0)
    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener(BUG_REPORTS_SEEN_EVENT, clear)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener(BUG_REPORTS_SEEN_EVENT, clear)
    }
  }, [enabled])
  return enabled ? count : 0
}
