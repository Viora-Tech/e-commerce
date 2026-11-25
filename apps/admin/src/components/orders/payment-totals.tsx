'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
import { orderStatusCardsContent } from '@/data/order-cards'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'
import { totalRows } from './order-totals'

type PaymentTotalsProps = {
  order: OrderDetail
}

/**
 * The Payment card's bill, after Shopify's: label | muted note | amount, a rule before the
 * total and another before what was paid. GST is one "GST (included)" line that opens to the
 * CGST/SGST or IGST split and the GST number it is billed from.
 */
export default function PaymentTotals({ order }: PaymentTotalsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const cards = useCopy(orderStatusCardsContent)
  const fmt = useFormat()
  const [taxOpen, setTaxOpen] = useState(false)

  // Event handlers
  const handleToggleTax = () => setTaxOpen((v) => !v)

  // Render logic
  const lines: TotalsLine[] = totalRows(order, copy, fmt)
    .filter((r) => r.tax !== 'split' || taxOpen)
    .map((r) => ({
      label:
        r.tax === 'sum' ? (
          <button
            type="button"
            onClick={handleToggleTax}
            aria-expanded={taxOpen}
            title={cards.gstSplit}
            className="group inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {r.label}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-3.5 transition-transform ease-out', taxOpen && 'rotate-180')}
            />
          </button>
        ) : r.tax === 'split' ? (
          <span className="pl-4 text-caption">{r.label}</span>
        ) : (
          r.label
        ),
      value: r.value,
      detail: r.detail,
      quiet: r.muted,
      strong: r.strong,
      rule: r.rule,
    }))

  return <TotalsList lines={lines} columns />
}
