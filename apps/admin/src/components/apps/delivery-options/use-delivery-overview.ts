'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Overview, RouteCatalogue } from './format'

/**
 * The app's overview (options, rules, route settings, apps, health), with a reload. `failed`:
 * the last read did not answer, so a page with no overview yet shows "Could not load" with Try
 * again (`reload`) instead of staying blank.
 */
export function useDeliveryOverview(): {
  overview: Overview | null
  failed: boolean
  reload: () => void
} {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (version < 0) return
    setFailed(false)
    api.deliveryOptions
      .overview()
      .then(setOverview)
      .catch(() => setFailed(true))
  }, [version])

  return { overview, failed, reload: () => setVersion((v) => v + 1) }
}

/**
 * Every route the connected apps offer (Routes, the courier list). Asks through checkout's
 * answer cache, so it is quick once checkout has asked; `null` while loading, and on failure.
 */
export function useRouteCatalogue(enabled = true): {
  catalogue: RouteCatalogue | null
  loading: boolean
  reload: () => void
} {
  const [catalogue, setCatalogue] = useState<RouteCatalogue | null>(null)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled || version < 0) return
    let live = true
    setLoading(true)
    api.deliveryOptions
      .routeCatalogue()
      .then((c) => {
        if (live) setCatalogue(c)
      })
      .catch(() => {
        if (live) setCatalogue(null)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [enabled, version])

  return { catalogue, loading, reload: () => setVersion((v) => v + 1) }
}
