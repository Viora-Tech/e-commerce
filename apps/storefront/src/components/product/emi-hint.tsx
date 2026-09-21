'use client'

import { formatPaise } from '@commerce/blocks'
import { lowestEmiPaise } from '@commerce/core/emi'
import { emiHintContent } from '@/data/product'

type EmiHintProps = {
  pricePaise: number
}

/** "EMI from ₹X/month" under the product price. Only mounted when the store offers EMI. */
export function EmiHint({ pricePaise }: EmiHintProps) {
  if (pricePaise < emiHintContent.minPricePaise) return null
  const monthly = formatPaise(lowestEmiPaise(pricePaise))

  return (
    <p className="emi-hint text-small" title={emiHintContent.detail}>
      {emiHintContent.label(monthly)}
    </p>
  )
}
