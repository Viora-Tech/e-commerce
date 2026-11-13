'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Overview, RouteCatalogue } from './format'

/** The app's overview (options, rules, route settings, apps, health), with a reload. */
export function useDeliveryOverview(): { overview: Overview | null; reload: () => void } {
  const copy = useCopy(deliveryOptionsContent)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (version < 0) return
    api.deliveryOptions
      .overview()
      .then(setOverview)
      .catch((err) => toast.error(err instanceof Error ? err.message : copy.failed))
  }, [version, copy.failed])

  return { overview, reload: () => setVersion((v) => v + 1) }
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
