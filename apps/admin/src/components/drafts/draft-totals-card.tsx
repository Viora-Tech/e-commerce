'use client'

import { parseRupees } from '@commerce/money'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DraftTotalsCardProps = {
  form: DraftFormState
  /** GST already inside a saved draft's prices; null when it has none. */
  tax: { ratePercent: number; taxPaise: number } | null
  onChange: (patch: Partial<DraftFormState>) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/** The bill (Figma "Payment"): subtotal, an editable discount and shipping, and the total. */
export default function DraftTotalsCard({ form, tax, onChange }: DraftTotalsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
  const fmt = useFormat()
  const [discount, setDiscount] = useState(paiseToText(form.discountPaise))
  const [shipping, setShipping] = useState(paiseToText(form.shippingPaise))

  // Event handlers
  const handleDiscount = (value: string) => {
    setDiscount(value)
    onChange({ discountPaise: parseRupees(value) ?? 0 })
  }
  const handleShipping = (value: string) => {
    setShipping(value)
    onChange({ shippingPaise: parseRupees(value) ?? 0 })
  }

  // Render logic
  const { subtotalPaise, totalPaise } = draftTotals(form)
  const itemCount = form.lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <DataCard title={copy.totals.heading} bodyClassName="flex flex-col gap-4">
      <div className="flex items-baseline justify-between text-body">
        <p className="flex items-baseline gap-2">
          <span className="text-foreground">{copy.totals.subtotal}</span>
          <span className="text-caption text-muted-foreground">{copy.totals.items(itemCount)}</span>
        </p>
        <p className="tabular-nums">{fmt.money(subtotalPaise)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-discount" className="text-xs text-muted-foreground">
            {copy.totals.discount}
          </label>
          <MoneyInput id="draft-discount" value={discount} onChange={handleDiscount} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-discount-label" className="text-xs text-muted-foreground">
            {copy.totals.discountLabel}
          </label>
          <Input
            id="draft-discount-label"
            value={form.discountLabel}
            onChange={(e) => onChange({ discountLabel: e.target.value })}
            className="h-9 w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-shipping" className="text-xs text-muted-foreground">
            {copy.totals.shipping}
          </label>
          <MoneyInput id="draft-shipping" value={shipping} onChange={handleShipping} />
        </div>
      </div>
      {tax ? (
        <div className="flex items-center justify-between text-body text-muted-foreground">
          <p>{copy.totals.gstIncluded(tax.ratePercent)}</p>
          <p className="tabular-nums">{fmt.money(tax.taxPaise)}</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-line border-t pt-3 text-body font-semibold text-ink-strong">
        <p>{copy.totals.total}</p>
        <p className="tabular-nums">{fmt.money(totalPaise)}</p>
      </div>
    </DataCard>
  )
}
