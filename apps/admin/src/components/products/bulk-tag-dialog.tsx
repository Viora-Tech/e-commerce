'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type BulkTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (tag: string) => void
}

/** Asks for the tag to add to every selected product. */
export default function BulkTagDialog({ open, onOpenChange, onApply }: BulkTagDialogProps) {
  // Hooks
  const { bulk: copy } = useCopy(productsListContent)
  const [tag, setTag] = useState('')

  // Event handlers
  const handleApply = () => {
    const value = tag.trim()
    if (!value) return
    onApply(value)
    setTag('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.addTag}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-tag">{copy.tagPrompt}</FieldLabel>
          <Input
            id="bulk-tag"
            value={tag}
            placeholder={copy.tagPlaceholder}
            autoComplete="off"
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApply()
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleApply} disabled={tag.trim() === ''}>
            {copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
