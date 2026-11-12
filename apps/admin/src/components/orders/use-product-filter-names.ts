'use client'

import { useEffect, useState } from 'react'
import type { PickRow } from '@/components/products/select-products-row'
import { api } from '@/lib/api-client'
import { namesFromRows, type ProductPick } from '@/lib/product-filter-selection'

/** The most picks one look-up names (the picker API's page). */
const LOOKUP_MAX = 50

/**
 * Names for the Orders Product filter's chip. A tick names its row straight away (`remember`);
 * picks that came from the URL (a reload, a shared link, back/forward) are looked up by id.
 */
export function useProductFilterNames(pick: ProductPick) {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())

  const missingProducts = pick.productIds.filter((id) => !names.has(id)).slice(0, LOOKUP_MAX)
  const missingVariants = pick.variantIds.filter((id) => !names.has(id)).slice(0, LOOKUP_MAX)
  const missingKey = `${missingProducts.join(',')}|${missingVariants.join(',')}`

  // biome-ignore lint/correctness/useExhaustiveDependencies: `missingKey` stands for both id lists.
  useEffect(() => {
    if (missingProducts.length === 0 && missingVariants.length === 0) return
    let cancelled = false
    api.products
      .pick({
        limit: LOOKUP_MAX,
        ...(missingProducts.length ? { ids: missingProducts } : {}),
        ...(missingVariants.length ? { variantIds: missingVariants } : {}),
      })
      .then((rows) => {
        if (cancelled) return
        setNames((prev) => new Map([...prev, ...namesFromRows(rows)]))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [missingKey])

  const remember = (row: PickRow) => setNames((prev) => new Map([...prev, ...namesFromRows([row])]))

  return { names, remember }
}
