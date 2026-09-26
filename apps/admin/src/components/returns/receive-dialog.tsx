'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import { returnDetailContent } from '@/data/returns'
import { api } from '@/lib/api-client'
import ChoiceList from './choice-list'

type Condition = 'good' | 'used' | 'damaged'

type ReceiveDialogProps = {
  returnId: string
  open: boolean
  /** The store's "restock automatically" rule, the default for good items. */
  restockByDefault: boolean
  onClose: () => void
  onDone: () => void
}

const copy = returnDetailContent.receive

const isCondition = (v: string): v is Condition => v === 'good' || v === 'used' || v === 'damaged'

/** The parcel arrived: check the condition and choose whether it goes back in stock. */
export default function ReceiveDialog({
  returnId,
  open,
  restockByDefault,
  onClose,
  onDone,
}: ReceiveDialogProps) {
  // Hooks
  const [condition, setCondition] = useState<Condition>('good')
  const [restock, setRestock] = useState(restockByDefault)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleCondition = (v: string) => {
    if (!isCondition(v)) return
    setCondition(v)
    // Only good items are sellable again; the merchant can still tick it by hand.
    setRestock(v === 'good' && restockByDefault)
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await api.returns.receive({
        id: returnId,
        condition,
        note: note.trim() || undefined,
        restock,
      })
      toast.success(copy.done)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <ChoiceList
          name="condition"
          value={condition}
          onChange={handleCondition}
          choices={[
            { value: 'good', label: copy.good },
            { value: 'used', label: copy.used },
            { value: 'damaged', label: copy.damaged },
          ]}
        />
        <Field orientation="horizontal" className="items-start">
          <Checkbox
            id="receive-restock"
            checked={restock}
            onCheckedChange={(v) => setRestock(Boolean(v))}
          />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="receive-restock">{copy.restock}</FieldLabel>
            <FieldDescription>{copy.restockHint}</FieldDescription>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="receive-note">{copy.note}</FieldLabel>
          <Textarea
            id="receive-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {returnDetailContent.cancel}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
