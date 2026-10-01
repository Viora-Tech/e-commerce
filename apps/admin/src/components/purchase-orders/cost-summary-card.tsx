'use client'

import { purchaseOrderTotals } from '@commerce/core/inventory'
import { parseRupees } from '@commerce/money'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { purchaseOrderFormContent } from '@/data/inventory'
import { formatPaise } from '@/lib/money'
import { lineNumbers, type PoForm } from './form-state'

type CostSummaryCardProps = {
  form: PoForm
  disabled: boolean
  onChange: (patch: { shipping?: string; tax?: string }) => void
}

const copy = purchaseOrderFormContent.cost

/** Subtotal from the lines, plus shipping and taxes typed here, to the order total. */
export default function CostSummaryCard({ form, disabled, onChange }: CostSummaryCardProps) {
  // Render logic
  const totals = purchaseOrderTotals(
    lineNumbers(form),
    parseRupees(form.shipping) ?? 0,
    parseRupees(form.tax) ?? 0,
  )

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-body">
        <div className="flex items-center justify-between gap-3">
          <span>
            {copy.subtotal}
            <span className="ml-2 text-caption text-muted-foreground">
              {copy.units(totals.units)}
            </span>
          </span>
          <span className="tabular-nums">{formatPaise(totals.subtotalPaise)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="po-shipping">{copy.shipping}</label>
          <Input
            id="po-shipping"
            value={form.shipping}
            inputMode="decimal"
            placeholder="0"
            disabled={disabled}
            className="w-28 text-right tabular-nums"
            onChange={(e) => onChange({ shipping: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="po-tax">{copy.tax}</label>
          <Input
            id="po-tax"
            value={form.tax}
            inputMode="decimal"
            placeholder="0"
            disabled={disabled}
            className="w-28 text-right tabular-nums"
            onChange={(e) => onChange({ tax: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-line border-t pt-3 text-body-strong">
          <span>{copy.total}</span>
          <span className="tabular-nums">{formatPaise(totals.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
