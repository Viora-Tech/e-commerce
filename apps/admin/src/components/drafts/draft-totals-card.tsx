'use client'

import { parseRupees } from '@commerce/money'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
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
  const lines: TotalsLine[] = [
    { label: copy.totals.subtotal, value: fmt.money(subtotalPaise) },
    {
      label: <label htmlFor="draft-discount">{copy.totals.discount}</label>,
      value: (
        <div className="w-36">
          <MoneyInput id="draft-discount" value={discount} onChange={handleDiscount} />
        </div>
      ),
    },
    {
      label: <label htmlFor="draft-discount-label">{copy.totals.discountLabel}</label>,
      value: (
        <div className="w-36">
          <Input
            id="draft-discount-label"
            value={form.discountLabel}
            onChange={(e) => onChange({ discountLabel: e.target.value })}
          />
        </div>
      ),
    },
    {
      label: <label htmlFor="draft-shipping">{copy.totals.shipping}</label>,
      value: (
        <div className="w-36">
          <MoneyInput id="draft-shipping" value={shipping} onChange={handleShipping} />
        </div>
      ),
    },
    { label: copy.totals.total, value: fmt.money(totalPaise), strong: true },
  ]

  return (
    <DataCard title={copy.totals.heading}>
      <TotalsList lines={lines} />
    </DataCard>
  )
}
