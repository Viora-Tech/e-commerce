'use client'

import { purchaseOrderTotals } from '@commerce/core/inventory'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { formRate, lineNumbers, type PoForm } from './form-state'

type CostSummaryCardProps = {
  form: PoForm
  /** The order's own charges with their GST, as last saved. */
  chargesPaise: number
}

/** Goods in rupees (converted at the order's rate) plus the order's charges, to the total. */
export default function CostSummaryCard({ form, chargesPaise }: CostSummaryCardProps) {
  // Hooks
  const { cost: copy } = useCopy(purchaseOrderFormContent)

  // Render logic
  const totals = purchaseOrderTotals(lineNumbers(form), chargesPaise)
  const rate = formRate(form)

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-body">
        <div className="flex items-start justify-between gap-3">
          <span className="flex flex-col">
            <span>
              {copy.subtotal}
              <span className="ml-2 text-caption text-muted-foreground">
                {copy.units(totals.units)}
              </span>
            </span>
            {form.currency !== 'INR' && rate ? (
              <span className="text-caption text-muted-foreground">
                {copy.converted(form.currency, rate)}
              </span>
            ) : null}
          </span>
          <span className="tabular-nums">{formatPaise(totals.subtotalPaise)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="flex flex-col">
            <span>{copy.charges}</span>
            <span className="text-caption text-muted-foreground">{copy.chargesHint}</span>
          </span>
          <span className="tabular-nums">{formatPaise(totals.chargesPaise)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-line border-t pt-3 text-body-strong">
          <span>{copy.total}</span>
          <span className="tabular-nums">{formatPaise(totals.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
