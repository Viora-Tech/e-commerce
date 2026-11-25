'use client'

import { dayKey } from '@commerce/dates'
import { FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import FormDialog from '@/components/layout/form-dialog'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import type { QueueRow } from './queue-columns'
import TextField from './text-field'

type AlreadyInvoicedDialogProps = {
  /** The queued order being recorded; null keeps the dialog closed. */
  row: QueueRow | null
  onClose: () => void
  /** The invoice was recorded: the order has left the queue. */
  onRecorded: () => void
}

/** Midday IST on a day, so a date never slips across midnight (as the review step sends it). */
const atIstNoon = (day: string) => new Date(`${day}T12:00:00+05:30`)

/**
 * "Already invoiced" on a Queue row: type the number and date of the invoice issued outside
 * Koomerce, or leave both blank for an old order whose details are gone (it then counts in no
 * Koomerce return). Both or neither; the server refuses a number this GST number already used
 * in that financial year.
 */
export default function AlreadyInvoicedDialog({
  row,
  onClose,
  onRecorded,
}: AlreadyInvoicedDialogProps) {
  // Hooks
  const copy = useCopy(gstAlreadyInvoicedContent)
  const [number, setNumber] = useState('')
  // The parent keys this dialog by row, so each row starts clean and blank.
  const [day, setDay] = useState('')

  // Event handlers
  const handleSubmit = async () => {
    if (!row) return
    const today = dayKey(new Date())
    const typed = number.trim()
    try {
      const r = await api.gstInvoices.queue.recordExternal(
        typed && day
          ? { id: row.id, number: typed, invoiceDate: day === today ? new Date() : atIstNoon(day) }
          : { id: row.id },
      )
      toast.success(
        typed ? copy.recorded(r?.number ?? typed.toUpperCase()) : copy.recordedBlank(row.orderName),
      )
      onRecorded()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    }
  }

  // Render logic
  const today = dayKey(new Date())
  const hasNumber = number.trim().length > 0
  const hasDay = day.length > 0
  const half = hasNumber !== hasDay

  return (
    <FormDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={copy.title(row?.orderName ?? '')}
      description={copy.body}
      submitLabel={hasNumber || hasDay ? copy.submit : copy.submitBlank}
      submitDisabled={half}
      dirty={hasNumber || hasDay}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-3">
        <TextField
          id="gst-external-number"
          label={copy.number}
          help={copy.numberHelp}
          value={number}
          maxLength={16}
          onChange={setNumber}
        />
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="gst-external-date">{copy.date}</FieldLabel>
          <DateField id="gst-external-date" value={day} max={today} clearable onChange={setDay} />
          <FieldDescription>{copy.dateHelp}</FieldDescription>
        </div>
        <p
          className={half ? 'text-caption text-destructive' : 'text-caption text-muted-foreground'}
        >
          {half ? copy.bothOrNeither : copy.blankHelp}
        </p>
      </div>
    </FormDialog>
  )
}
