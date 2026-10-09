'use client'

import { parseRupees } from '@commerce/money'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DraftTotalsCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/** The bill (Figma "Payment"): subtotal, an editable discount and shipping, and the total. */
export default function DraftTotalsCard({ form, onChange }: DraftTotalsCardProps) {
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

  return (
    <Card gap={4} inset={5}>
      <p className="text-card-title text-ink-strong">{copy.totals.heading}</p>
      <dl className="flex flex-col gap-3 text-body">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">{copy.totals.subtotal}</dt>
          <dd className="tabular-nums">{fmt.money(subtotalPaise)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">
            <label htmlFor="draft-discount">{copy.totals.discount}</label>
          </dt>
          <dd className="w-36">
            <MoneyInput id="draft-discount" value={discount} onChange={handleDiscount} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">
            <label htmlFor="draft-discount-label">{copy.totals.discountLabel}</label>
          </dt>
          <dd className="w-36">
            <Input
              id="draft-discount-label"
              value={form.discountLabel}
              onChange={(e) => onChange({ discountLabel: e.target.value })}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">
            <label htmlFor="draft-shipping">{copy.totals.shipping}</label>
          </dt>
          <dd className="w-36">
            <MoneyInput id="draft-shipping" value={shipping} onChange={handleShipping} />
          </dd>
        </div>
        <div className="flex items-center justify-between border-line border-t pt-3 font-semibold text-ink-strong">
          <dt>{copy.totals.total}</dt>
          <dd className="tabular-nums">{fmt.money(totalPaise)}</dd>
        </div>
      </dl>
    </Card>
  )
}
