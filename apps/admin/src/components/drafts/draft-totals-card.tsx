'use client'

import { parseRupees } from '@commerce/money'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DraftDiscountCode from '@/components/drafts/draft-discount-code'
import type { DraftCodeCheck, DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import { useDraftCodeCheck } from '@/components/drafts/use-draft-code-check'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DraftTotalsCardProps = {
  form: DraftFormState
  /** GST already inside a saved draft's prices; null when it has none. */
  tax: { ratePercent: number; taxPaise: number } | null
  /** The saved draft's code as last applied, shown until the live re-check answers. */
  savedCheck: DraftCodeCheck | null
  onChange: (patch: Partial<DraftFormState>) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/**
 * The bill (Figma "Payment"): subtotal, a store discount code or a manual discount (one or
 * the other, never both), shipping, and the total.
 */
export default function DraftTotalsCard({ form, tax, savedCheck, onChange }: DraftTotalsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
  const fmt = useFormat()
  const { check, apply } = useDraftCodeCheck(form, savedCheck)
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
  // A code replaces the manual discount, so applying one clears it.
  const handleCodeApplied = (code: string) => {
    setDiscount('')
    onChange({ discountCode: code, discountPaise: 0, discountLabel: '' })
  }

  // Render logic
  const totals = draftTotals(form, check)
  const itemCount = form.lines.reduce((sum, l) => sum + l.quantity, 0)
  const coded = Boolean(form.discountCode)

  return (
    <DataCard title={copy.totals.heading} bodyClassName="flex flex-col gap-4">
      <div className="flex items-baseline justify-between text-body">
        <p className="flex items-baseline gap-2">
          <span className="text-foreground">{copy.totals.subtotal}</span>
          <span className="text-caption text-muted-foreground">{copy.totals.items(itemCount)}</span>
        </p>
        <p className="tabular-nums">{fmt.money(totals.subtotalPaise)}</p>
      </div>
      <DraftDiscountCode
        code={form.discountCode}
        check={check}
        onApply={apply}
        onApplied={handleCodeApplied}
        onRemove={() => onChange({ discountCode: '' })}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {coded ? null : (
          <>
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
          </>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-shipping" className="text-xs text-muted-foreground">
            {copy.totals.shipping}
          </label>
          <MoneyInput id="draft-shipping" value={shipping} onChange={handleShipping} />
        </div>
      </div>
      {coded && totals.discountPaise > 0 ? (
        <div className="flex items-center justify-between text-body text-muted-foreground">
          <p>{copy.totals.discount}</p>
          <p className="tabular-nums">−{fmt.money(totals.discountPaise)}</p>
        </div>
      ) : null}
      {totals.shippingPaise !== form.shippingPaise ? (
        <div className="flex items-center justify-between text-body text-muted-foreground">
          <p>{copy.totals.code.freeShipping}</p>
          <p className="tabular-nums">−{fmt.money(form.shippingPaise - totals.shippingPaise)}</p>
        </div>
      ) : null}
      {tax ? (
        <div className="flex items-center justify-between text-body text-muted-foreground">
          <p>{copy.totals.gstIncluded(tax.ratePercent)}</p>
          <p className="tabular-nums">{fmt.money(tax.taxPaise)}</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-line border-t pt-3 text-body font-semibold text-ink-strong">
        <p>{copy.totals.total}</p>
        <p className="tabular-nums">{fmt.money(totals.totalPaise)}</p>
      </div>
    </DataCard>
  )
}
