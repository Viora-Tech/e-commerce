'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

/** Most orders asked about at once; a larger selection prints from the GST invoices app. */
const ASK_MAX = 100

/**
 * The issued GST invoices of the selected orders. Null when the GST invoices app is not
 * installed (or the selection is too large to ask about): Print invoices then uses the store's
 * own invoice template, as before.
 */
export function useOrderInvoices(ids: string[]): string[] | null {
  const key = ids.join(',')
  const [found, setFound] = useState<{ key: string; ids: string[] | null } | null>(null)

  useEffect(() => {
    const orderIds = key ? key.split(',') : []
    if (orderIds.length === 0 || orderIds.length > ASK_MAX) return
    let active = true
    api.gstInvoices.forOrders({ orderIds }).then(
      (r) => active && setFound({ key, ids: r.ids }),
      () => active && setFound({ key, ids: null }),
    )
    return () => {
      active = false
    }
  }, [key])

  return found?.key === key ? found.ids : null
}
