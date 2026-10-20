'use client'

import type { EmailProductCard } from '@commerce/core/marketing'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import EmailProductsPicker from '../email-products-picker'

type Item = EmailProductCard & { id: string }

export type BuilderProducts = { items: Item[]; columns: 1 | 2 | 3 }

type BuilderProductsDialogProps = {
  open: boolean
  defaultColumns: 1 | 2 | 3
  /** The pick, or null when cancelled (the dropped placeholder then stays). */
  onDone: (picked: BuilderProducts | null) => void
}

const COLUMNS = ['1', '2', '3'] as const

/** Picks products for a dropped product card or grid; each keeps a snapshot for the email. */
export default function BuilderProductsDialog({
  open,
  defaultColumns,
  onDone,
}: BuilderProductsDialogProps) {
  // Hooks
  const { products: copy } = useCopy(emailBuilderContent)
  const [items, setItems] = useState<Item[]>([])
  const [columns, setColumns] = useState<1 | 2 | 3 | null>(null)

  // Event handlers
  const handleClose = (picked: BuilderProducts | null) => {
    setItems([])
    setColumns(null)
    onDone(picked)
  }

  // Render logic
  const perRow = columns ?? defaultColumns

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <EmailProductsPicker items={items} onChange={(next) => setItems(next as Item[])} />
        <Field>
          <FieldLabel>{copy.columns}</FieldLabel>
          <ToggleGroup
            value={[String(perRow)]}
            onValueChange={(v) => v[0] && setColumns(Number(v[0]) as 1 | 2 | 3)}
            variant="outline"
            size="sm"
          >
            {COLUMNS.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(null)}>
            {copy.cancel}
          </Button>
          <Button
            onClick={() => handleClose({ items, columns: perRow })}
            disabled={items.length === 0}
          >
            {copy.insert}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
