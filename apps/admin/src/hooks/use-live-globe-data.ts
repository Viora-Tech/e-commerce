'use client'

import type { DashboardSummary } from '@commerce/api'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

const POLL_MS = 20_000

/** Polls `dashboard.summary` every ~20s while the tab is visible, starting from `initial`.
 *  Shared by the Home live-globe card and the Live view globe hero. */
export function useLiveGlobeData(initial: DashboardSummary): DashboardSummary {
  // Hooks
  const [data, setData] = useState(initial)

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setInterval> | null = null
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      api.dashboard.summary().then((next) => {
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
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      live = false
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return data
}
