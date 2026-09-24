'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'

type VariantBulkBarProps = {
  count: number
  onApply: (patch: { price?: string; quantity?: string }) => void
  onClear: () => void
}

const copy = productFormContent.variantBulk

/** Set one price or quantity across every selected variant row. */
export default function VariantBulkBar({ count, onApply, onClear }: VariantBulkBarProps) {
  // Hooks
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')

  // Event handlers
  const handleApply = () => {
    const patch: { price?: string; quantity?: string } = {}
    if (price.trim() !== '') patch.price = price.trim()
    if (quantity.trim() !== '') patch.quantity = quantity.trim()
    if (Object.keys(patch).length === 0) return
    onApply(patch)
    setPrice('')
    setQuantity('')
  }

  // Render logic
  const empty = price.trim() === '' && quantity.trim() === ''

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-border bg-primary-soft/60 px-5 py-2">
      <span className="text-body-strong">{copy.selected(count)}</span>
      <span className="w-32">
        <MoneyInput
          aria-label={copy.price}
          placeholder={copy.price}
          value={price}
          onChange={setPrice}
        />
      </span>
      <span className="w-32">
        <MoneyInput
          aria-label={copy.quantity}
          placeholder={copy.quantity}
          currency={false}
          value={quantity}
          onChange={setQuantity}
        />
      </span>
      <Button size="sm" onClick={handleApply} disabled={empty}>
        {copy.apply}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
