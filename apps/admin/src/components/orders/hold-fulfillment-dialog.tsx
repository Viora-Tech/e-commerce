'use client'

import {
  FULFILLMENT_HOLD_REASONS,
  type FulfillmentHoldReason,
} from '@commerce/core/order-edit-rules'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { orderHoldContent } from '@/data/order-hold'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type HoldFulfillmentDialogProps = {
  /** The order to hold; null keeps the dialog closed. */
  orderId: string | null
  onClose: () => void
  onDone: () => void
}

/** "Hold fulfilment" (#1011): a reason from the list and an optional note. */
export default function HoldFulfillmentDialog({
  orderId,
  onClose,
  onDone,
}: HoldFulfillmentDialogProps) {
  // Hooks
  const copy = useCopy(orderHoldContent)
  const [reason, setReason] = useState<FulfillmentHoldReason>('awaiting_stock')
  const [note, setNote] = useState('')

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (open) return
    setReason('awaiting_stock')
    setNote('')
    onClose()
  }
  const handleSubmit = async () => {
    if (!orderId) return
    try {
      await api.orders.holdFulfillment({ orderId, reason, note: note.trim() || undefined })
      toast.success(copy.held)
      setReason('awaiting_stock')
      setNote('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const reasonItems = FULFILLMENT_HOLD_REASONS.map((value) => ({
    value,
    label: copy.reasons[value],
  }))

  return (
    <FormDialog
      open={orderId !== null}
      onOpenChange={handleOpenChange}
      title={copy.dialog.title}
      description={copy.dialog.body}
      cancelLabel={copy.dialog.cancel}
      submitLabel={copy.dialog.confirm}
      onSubmit={handleSubmit}
    >
      <Field>
        <FieldLabel htmlFor="hold-reason">{copy.dialog.reason}</FieldLabel>
        <Select
          items={reasonItems}
          value={reason}
          onValueChange={(v) => v && setReason(v as FulfillmentHoldReason)}
        >
          <SelectTrigger id="hold-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reasonItems.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="hold-note">{copy.dialog.note}</FieldLabel>
        <Textarea
          id="hold-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.dialog.notePlaceholder}
        />
      </Field>
    </FormDialog>
  )
}
