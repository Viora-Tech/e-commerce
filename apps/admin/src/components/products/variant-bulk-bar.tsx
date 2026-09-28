'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

/** Fields left blank are not touched; `skuPrefix` becomes PREFIX-VALUE-VALUE per row. */
export type VariantBulkPatch = { price?: string; quantity?: string; skuPrefix?: string }

type VariantBulkBarProps = {
  count: number
  onApply: (patch: VariantBulkPatch) => void
  onClear: () => void
}

/** Set one price, quantity or SKU prefix across every selected variant row. */
export default function VariantBulkBar({ count, onApply, onClear }: VariantBulkBarProps) {
  // Hooks
  const { variantBulk: copy } = useCopy(productFormContent)
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [skuPrefix, setSkuPrefix] = useState('')

  // Event handlers
  const handleApply = () => {
    const patch: VariantBulkPatch = {}
    if (price.trim() !== '') patch.price = price.trim()
    if (quantity.trim() !== '') patch.quantity = quantity.trim()
    if (skuPrefix.trim() !== '') patch.skuPrefix = skuPrefix.trim()
    if (Object.keys(patch).length === 0) return
    onApply(patch)
    setPrice('')
    setQuantity('')
    setSkuPrefix('')
  }

  // Render logic
  const empty = price.trim() === '' && quantity.trim() === '' && skuPrefix.trim() === ''

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
      <span className="w-36">
        <Input
          aria-label={copy.sku}
          placeholder={copy.sku}
          title={copy.skuHelp}
          value={skuPrefix}
          onChange={(e) => setSkuPrefix(e.target.value)}
          autoComplete="off"
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
