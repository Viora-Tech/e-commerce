'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'

/** What the order spent in store credit, and the expiry to pre-fill when it goes back. */
export type StoreCreditReturnDefault = {
  spentPaise: number
  /** `YYYY-MM-DD`, never before today (a past date cannot be picked); '' never expires. */
  expiresOn: string
}

/**
 * For the cancel, refund and return dialogs (owner, 12 Nov 2026): the store credit the order was
 * paid with and the expiry to pre-fill when it goes back, the latest last day of the credit it
 * was spent from, or empty when any of it never expires. Null while loading, or with no order.
 */
export function useStoreCreditReturn(orderId: string | null): StoreCreditReturnDefault | null {
  // Hooks
  const [value, setValue] = useState<StoreCreditReturnDefault | null>(null)

  useEffect(() => {
    setValue(null)
    if (!orderId) return
    let live = true
    api.storeCredit
      .getOrderExpiry({ orderId })
      .then((r) => {
        if (!live) return
        const today = todayKey()
        const day = r.expiresOn && r.expiresOn < today ? today : (r.expiresOn ?? '')
        setValue({ spentPaise: r.spentPaise, expiresOn: day })
      })
      .catch(() => {
        if (live) setValue({ spentPaise: 0, expiresOn: '' })
      })
    return () => {
      live = false
    }
  }, [orderId])

  return value
}
