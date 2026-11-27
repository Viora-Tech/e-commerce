'use client'

import type { DocumentSnapshot } from '@commerce/invoices'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import InvoiceEditSheet from './invoice-edit-sheet'
import InvoiceHistoryList from './invoice-history-list'
import { monthLabel } from './return-months'

type InvoiceEditCardProps = {
  invoiceId: string
  orderId: string
  number: string
  snapshot: DocumentSnapshot
  /** The invoice changed: the page reads it again. */
  onSaved: () => void
}

/**
 * The invoice page's Edit invoice card: the button while the month is open and before the
 * GSTR-1 due date, else why it is locked and the credit note / new invoice way; then the edit
 * history with each earlier version's totals and PDF.
 */
export default function InvoiceEditCard({
  invoiceId,
  orderId,
  number,
  snapshot,
  onSaved,
}: InvoiceEditCardProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.card)
  const [editing, setEditing] = useState(false)
  const { data, retry } = useLoad(() => api.gstInvoices.getEdit({ id: invoiceId }), [invoiceId])

  // Event handlers
  const handleSaved = () => {
    setEditing(false)
    retry()
    onSaved()
  }

  // Early returns
  if (!data) return null
  // A credit note, a queued draft or another document has nothing to edit here.
  if (data.lock.reason === 'not_tax_invoice' || data.lock.reason === 'not_issued') return null

  // Render logic
  const { lock, versions } = data
  const month = lock.period ? monthLabel(lock.period) : ''
  const reason = lock.reason
  const lockText = !reason
    ? null
    : reason === 'filed' || reason === 'closed' || reason === 'due_passed'
      ? copy.locked[reason](month)
      : copy.locked[reason]

  return (
    <DataCard bodyClassName="flex flex-col gap-4" title={copy.title}>
      {lock.editable ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[40rem] text-body text-muted-foreground">
            {copy.editable(lock.dueDate ? formatDate(lock.dueDate) : '')}
          </p>
          <Button onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {copy.button}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-body">{lockText}</p>
          {reason !== 'cancelled' && reason !== 'external' ? (
            <p className="text-caption text-muted-foreground">{copy.guidance}</p>
          ) : null}
        </div>
      )}
      {versions.length > 0 ? (
        <InvoiceHistoryList invoiceId={invoiceId} versions={versions} />
      ) : null}
      {editing ? (
        <InvoiceEditSheet
          invoiceId={invoiceId}
          orderId={orderId}
          number={number}
          snapshot={snapshot}
          start={data.form}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </DataCard>
  )
}
