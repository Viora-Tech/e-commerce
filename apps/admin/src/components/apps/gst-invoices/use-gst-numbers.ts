'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { GstNumberOption } from '@/lib/gst-list-filters'

/**
 * The store's GST numbers for the lists' GST number filter (shown only with two or more). A
 * failed read leaves the list empty, so the filter simply does not show.
 */
export function useGstNumbers(): GstNumberOption[] {
  // Hooks
  const [numbers, setNumbers] = useState<GstNumberOption[]>([])
  useEffect(() => {
    let active = true
    api.gstInvoices
      .gstNumbers()
      .then((r) => {
        if (active)
          setNumbers(
            r.numbers.map((n) => ({ ...n, stateName: n.stateName ?? n.stateCode ?? null })),
          )
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return numbers
}
