'use client'

import { variantTitle } from '@commerce/core/catalog'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { VariantRow } from './form-state'
import { generateSku } from './sku'
import VariantEditFields from './variant-edit-fields'

type VariantEditDialogProps = {
  /** The product's title, the stem of a generated SKU. */
  productTitle: string
  variants: VariantRow[]
  /** The row being edited; the dialog is keyed by it so the draft starts fresh. */
  index: number
  /** Applies the draft to the row. */
  onSave: (index: number, patch: Partial<VariantRow>) => void
  /** Saves the draft, then opens the previous or next row. */
  onMove: (index: number) => void
  onClose: () => void
}

/**
 * One variant's details in a centred dialog (#914: no inline clutter in the variants table,
 * no right drawer). Edits stay in a draft until Done; Previous and Next keep them too.
 */
export default function VariantEditDialog({
  productTitle,
  variants,
  index,
  onSave,
  onMove,
  onClose,
}: VariantEditDialogProps) {
  // Hooks
  const { variants: variantsCopy } = useCopy(productFormContent)
  const fmt = useFormat()
  const [draft, setDraft] = useState<VariantRow | undefined>(variants[index])

  // Helpers
  const patch = (p: Partial<VariantRow>) => setDraft((d) => (d ? { ...d, ...p } : d))

  // Event handlers
  const handleGenerateSku = () => {
    if (!draft) return
    const taken = variants.filter((_, j) => j !== index).map((v) => v.sku)
    patch({ sku: generateSku(productTitle, draft.optionValues, taken) })
  }

  const handleDone = () => {
    if (draft) onSave(index, draft)
    onClose()
  }

  const handleMove = (to: number) => {
    if (draft) onSave(index, draft)
    onMove(to)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  // Early returns
  if (!draft) return null

  // Render logic
  const copy = variantsCopy.dialog
  const title = variantTitle(draft.optionValues)
  const hasPrevious = index > 0
  const hasNext = index < variants.length - 1

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90svh,48rem)] w-full flex-col gap-0 p-0 sm:max-w-[42rem]">
        <DialogHeader className="gap-1 border-b p-4">
          <DialogTitle className="text-base font-medium">{copy.title(title)}</DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <VariantEditFields draft={draft} onPatch={patch} onGenerateSku={handleGenerateSku} />
        </div>

        <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-between">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.previous}
              title={copy.previous}
              disabled={!hasPrevious}
              onClick={() => handleMove(index - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <span className="text-caption text-muted-foreground tabular-nums">
              {copy.position(fmt.number(index + 1), fmt.number(variants.length))}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.next}
              title={copy.next}
              disabled={!hasNext}
              onClick={() => handleMove(index + 1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={handleDone}>
              <CheckIcon aria-hidden="true" />
              {copy.done}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
