'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

/** Fields left blank are not touched; `skuPrefix` becomes PREFIX-VALUE-VALUE per row. */
export type VariantBulkPatch = {
  price?: string
  mrp?: string
  quantity?: string
  skuPrefix?: string
}

type VariantBulkBarProps = {
  count: number
  onApply: (patch: VariantBulkPatch) => void
  /** Fills a SKU on every selected row that has none. */
  onGenerateSkus: () => void
  /** Asks first (the card's dialog), then removes the selected rows. */
  onDelete: () => void
  onClear: () => void
}

type Field = keyof VariantBulkPatch

/**
 * One row above the selected variants (Figma 949:8022): each field opens a small box with its
 * own Apply, so the bar never wraps; Generate SKUs and Delete act on the selection.
 */
export default function VariantBulkBar({
  count,
  onApply,
  onGenerateSkus,
  onDelete,
  onClear,
}: VariantBulkBarProps) {
  // Hooks
  const { variantBulk: copy } = useCopy(productFormContent)
  const [open, setOpen] = useState<Field | null>(null)
  const [value, setValue] = useState('')

  // Event handlers
  const handleOpen = (field: Field, next: boolean) => {
    setOpen(next ? field : null)
    setValue('')
  }

  const handleApply = () => {
    if (!open || value.trim() === '') return
    onApply({ [open]: value.trim() })
    setOpen(null)
    setValue('')
  }

  // Render logic
  const fields: { id: Field; label: string }[] = [
    { id: 'price', label: copy.price },
    { id: 'mrp', label: copy.mrp },
    { id: 'quantity', label: copy.quantity },
    { id: 'skuPrefix', label: copy.sku },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-y border-border bg-muted px-5 py-1.5">
      <span className="mr-2 shrink-0 text-body-strong">{copy.selected(count)}</span>
      {fields.map((f) => (
        <Popover key={f.id} open={open === f.id} onOpenChange={(next) => handleOpen(f.id, next)}>
          <PopoverTrigger
            render={
              <Button type="button" variant="ghost" size="sm" className="shrink-0">
                {f.label}
              </Button>
            }
          />
          <PopoverContent align="start" className="flex w-64 flex-col gap-2 p-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                handleApply()
              }}
            >
              {f.id === 'skuPrefix' ? (
                <Input
                  autoFocus
                  aria-label={f.label}
                  placeholder={f.label}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="off"
                />
              ) : (
                <MoneyInput
                  aria-label={f.label}
                  placeholder={f.label}
                  currency={f.id !== 'quantity'}
                  value={value}
                  onChange={setValue}
                />
              )}
              <Button type="submit" size="sm" disabled={value.trim() === ''}>
                {copy.apply}
              </Button>
            </form>
            <span className="text-caption text-muted-foreground">
              {f.id === 'skuPrefix' ? copy.skuHelp : copy.appliesTo(count)}
            </span>
          </PopoverContent>
        </Popover>
      ))}
      <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onGenerateSkus}>
        {copy.generateSkus}
      </Button>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
      <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={onDelete}>
        <Trash2 aria-hidden="true" />
        {copy.delete(count)}
      </Button>
      <span className="flex-1" />
      <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
