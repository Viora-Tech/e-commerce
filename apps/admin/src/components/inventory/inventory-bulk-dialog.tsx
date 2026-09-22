'use client'

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
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { inventoryContent, type ManualReasonValue } from '@/data/inventory'
import ReasonSelect from './reason-select'

export type BulkEdit = {
  mode: 'adjust' | 'set'
  value: number
  reason: ManualReasonValue
  note?: string | undefined
}

type InventoryBulkDialogProps = {
  mode: 'adjust' | 'set' | null
  count: number
  busy: boolean
  onOpenChange: (open: boolean) => void
  onApply: (edit: BulkEdit) => void
}

const copy = inventoryContent.bulk

/** "Adjust by" or "Set on hand to" for every selected SKU, with the reason logged. */
export default function InventoryBulkDialog({
  mode,
  count,
  busy,
  onOpenChange,
  onApply,
}: InventoryBulkDialogProps) {
  // Hooks
  const [value, setValue] = useState('')
  const [reason, setReason] = useState<ManualReasonValue>('correction')
  const [note, setNote] = useState('')

  // Event handlers
  const handleApply = () => {
    if (!mode) return
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return
    onApply({ mode, value: parsed, reason, note: note.trim() || undefined })
    setValue('')
    setNote('')
  }

  // Render logic
  const valid = mode === 'set' ? /^\d+$/.test(value.trim()) : /^-?\d+$/.test(value.trim())

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.title(mode ?? 'adjust', count)}</DialogTitle>
          <DialogDescription>{mode === 'set' ? copy.setHint : copy.adjustHint}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-quantity">{mode === 'set' ? copy.set : copy.adjust}</FieldLabel>
          <Input
            id="bulk-quantity"
            value={value}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) handleApply()
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="bulk-reason">{copy.reason}</FieldLabel>
          <ReasonSelect id="bulk-reason" value={reason} onChange={setReason} className="w-full" />
        </Field>
        <Field>
          <FieldLabel htmlFor="bulk-note">{copy.note}</FieldLabel>
          <Input
            id="bulk-note"
            value={note}
            placeholder={copy.notePlaceholder}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleApply} disabled={!valid || busy}>
            {copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
