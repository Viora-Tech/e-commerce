'use client'

import type { DashboardSummary } from '@commerce/api'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'

const POLL_MS = 20_000

/** Polls `dashboard.summary` every ~20s while the tab is visible, starting from `initial`.
 *  Shared by the Home live-globe card and the Live view globe hero. `mapRange` (the Live view
 *  globe's "Time range" setting) only changes what `mapOrders` covers; everything else in the
 *  summary keeps its own fixed windows. Changing it refetches right away. */
export function useLiveGlobeData(
  initial: DashboardSummary,
  mapRange: '1h' | '24h' | '7d' = '24h',
): DashboardSummary {
  // Hooks
  const [data, setData] = useState(initial)
  const mountedBefore = useRef(false)

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setInterval> | null = null
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      api.dashboard.summary({ mapRange }).then((next) => {
        if (live) setData(next)
      })
    }
    const start = () => {
      if (!timer) timer = setInterval(tick, POLL_MS)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === 'visible') {
      // `initial` already covers the first paint; a later run (the range setting changed)
      // refetches straight away instead of waiting for the next poll.
      if (mountedBefore.current) tick()
      start()
    }
    mountedBefore.current = true
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      live = false
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [mapRange])

  return data
}
