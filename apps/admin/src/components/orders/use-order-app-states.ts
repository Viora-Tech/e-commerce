'use client'

import { useEffect, useState } from 'react'
import { GST_INVOICES_CHANGED } from '@/apps/order-action-procedures'
import type { OrderActionGroup, OrderAppStates } from '@/apps/order-actions'
import { api } from '@/lib/api-client'

/** `apps.orderStates` takes at most this many orders a call (a page of the Orders list). */
const STATES_BATCH = 100

type Loaded = Record<string, Record<string, string[]>>

/**
 * What installed apps say about the orders on screen (`api.apps.orderStates`: `invoiced`,
 * `invoice-pdf`), for the actions gated by `whenState`. Asked once per order, and only when an
 * app has such an action; `forget` asks again after an action ran, and a GST invoices change
 * (the order page's Invoices card) asks again for every order. Unknown orders get null, so
 * their gated actions stay hidden until the answer arrives.
 */
export function useOrderAppStates(
  groups: readonly OrderActionGroup[],
  orderIds: readonly string[],
) {
  // Hooks
  const [loaded, setLoaded] = useState<Loaded>({})
  const gated = groups.some((g) => g.actions.some((a) => a.whenState?.length))
  const key = orderIds.join(',')

  useEffect(() => {
    const clear = () => setLoaded({})
    window.addEventListener(GST_INVOICES_CHANGED, clear)
    return () => window.removeEventListener(GST_INVOICES_CHANGED, clear)
  }, [])

  useEffect(() => {
    if (!gated || !key) return
    const missing = key.split(',').filter((id) => !(id in loaded))
    if (missing.length === 0) return
    let live = true
    const ask = async () => {
      for (let i = 0; i < missing.length; i += STATES_BATCH) {
        const part = missing.slice(i, i + STATES_BATCH)
        const states = await api.apps.orderStates({ orderIds: part })
        if (!live) return
        setLoaded((prev) => {
          const next = { ...prev }
          for (const id of part) next[id] = states[id] ?? {}
          return next
        })
      }
    }
    ask().catch(() => undefined)
    return () => {
      live = false
    }
  }, [gated, key, loaded])

  // Helpers
  const statesOf = (orderId: string): OrderAppStates => loaded[orderId] ?? null
  const forget = (ids: readonly string[]) => {
    setLoaded((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }

  return { statesOf, forget }
}
