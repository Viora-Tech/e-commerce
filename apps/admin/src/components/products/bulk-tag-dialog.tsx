'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type BulkTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (tag: string) => void
  /** Add the tag, or take it off (#26). */
  mode: 'add' | 'remove'
  /** How many products are selected, for the help line (Figma 627:3614). */
  count: number
}

/** Asks for the tag to add to, or remove from, every selected product. */
export default function BulkTagDialog({
  open,
  onOpenChange,
  onApply,
  mode,
  count,
}: BulkTagDialogProps) {
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

  // Render logic
  const adding = mode === 'add'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{adding ? copy.addTag : copy.removeTag}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-tag">{adding ? copy.tagPrompt : copy.untagPrompt}</FieldLabel>
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
          <FieldDescription>
            {adding ? copy.tagHelp(count) : copy.untagHelp(count)}
          </FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleApply} disabled={tag.trim() === ''}>
            <CheckIcon aria-hidden="true" />
            {copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
