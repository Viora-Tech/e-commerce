'use client'

import { MAX_PINS_PER_TERM, MAX_QUERY_LENGTH } from '@commerce/core/discovery'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useId, useState } from 'react'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'
import PickedList, { type PickedItem } from './picked-list'

type PinDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The search and its pins when editing; a new search starts empty (or with the shortcut's words). */
  term: string
  products: PickedItem[]
  /** Saves the pins; resolves when done, rejects to keep the dialog open. */
  onSave: (term: string, productIds: string[]) => Promise<void>
}

/** Pin products to one search, in order: the search's words and an ordered product list. */
export default function PinDialog({ open, onOpenChange, term, products, onSave }: PinDialogProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const termId = useId()
  const [draftTerm, setDraftTerm] = useState(term)
  const [items, setItems] = useState<PickedItem[]>(products)
  const [choosing, setChoosing] = useState(false)
  const [saving, setSaving] = useState(false)

  // A fresh draft each time the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the props are read when it opens
  useEffect(() => {
    if (!open) return
    setDraftTerm(term)
    setItems(products)
  }, [open])

  // Event handlers
  const handleChosen = (picked: PickedProducts) => {
    const added = picked
      .map((p) => ({ id: p.product.id, title: p.product.title, status: p.product.status }))
      .filter((p) => !items.some((x) => x.id === p.id))
    setItems([...items, ...added].slice(0, MAX_PINS_PER_TERM))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(
        draftTerm,
        items.map((i) => i.id),
      )
      onOpenChange(false)
    } catch {
      // The caller showed the error; the draft stays for another try.
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const d = copy.boosts.pinDialog
  const canSave = !saving && draftTerm.trim().length > 0 && items.length > 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{d.title}</DialogTitle>
            <DialogDescription>{copy.boosts.pins.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={termId}>{d.term}</FieldLabel>
              <Input
                id={termId}
                value={draftTerm}
                maxLength={MAX_QUERY_LENGTH}
                placeholder={d.termPlaceholder}
                onChange={(e) => setDraftTerm(e.target.value)}
              />
              <FieldDescription>{d.termHelp}</FieldDescription>
            </Field>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-strong">{d.products}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={items.length >= MAX_PINS_PER_TERM}
                  onClick={() => setChoosing(true)}
                >
                  <Plus aria-hidden="true" />
                  {d.choose}
                </Button>
              </div>
              <PickedList
                items={items}
                onChange={setItems}
                empty={d.noProducts}
                labels={{ moveUp: d.moveUp, moveDown: d.moveDown, remove: d.removeProduct }}
              />
              <p className="text-caption text-muted-foreground">{d.limit(MAX_PINS_PER_TERM)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {d.cancel}
            </Button>
            <Button loading={saving} disabled={!canSave} onClick={handleSave}>
              {d.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SelectProductsDialog
        open={choosing}
        onOpenChange={setChoosing}
        addedProductIds={items.map((i) => i.id)}
        onConfirm={handleChosen}
      />
    </>
  )
}
