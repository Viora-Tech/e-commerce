'use client'

import type { DocumentSnapshot } from '@commerce/invoices'
import { Download, Pencil, Printer, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { gstInvoiceActionsContent } from '@/data/gst-invoice-actions'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatDate } from '@/lib/format-date'
import { lockText } from './invoice-edit-lock'
import InvoiceEditSheet from './invoice-edit-sheet'

type Edit = Awaited<ReturnType<typeof api.gstInvoices.getEdit>>

type InvoiceDetailActionsProps = {
  invoiceId: string
  orderId: string
  /** The invoice number (or the order's), for the edit sheet's title. */
  number: string
  snapshot: DocumentSnapshot
  /** May it be edited now, and the edit form's values; `null` while loading. */
  edit: Edit | null
  /** Saved in the Edit invoice sheet: the page reads the invoice and its history again. */
  onEdited: () => void
  /** The order's email; `null` disables "Email to buyer" with the reason in a tooltip. */
  buyerEmail: string | null
  /** The page's own action (print, download, cancel...) that is running, if any. */
  busy: string | null
  onPrint: () => void
  onDownload: () => void
}

/** How long the page waits on the worker before saying the email is on its way. */
const POLL_MS = 1500
const POLL_TRIES = 12

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The invoice page's header actions (owner, 28 Nov 2026): "Email to buyer" as the one main
 * button; Edit invoice (greyed with its lock reason when locked), Print and Download PDF in the
 * ⋯ menu. Edit opens the same side sheet the Edit invoice card used to. The email goes through the Invoices list's bulk
 * Email (`gstInvoices.bulkEmail`) with this one invoice, so it is the same `document_copy` email
 * and job; the page then watches the batch to say whether it was sent.
 */
export default function InvoiceDetailActions({
  invoiceId,
  orderId,
  number,
  snapshot,
  edit,
  onEdited,
  buyerEmail,
  busy,
  onPrint,
  onDownload,
}: InvoiceDetailActionsProps) {
  // Hooks
  const copy = useCopy(gstInvoiceActionsContent.detail)
  const detailCopy = useCopy(gstInvoicesContent.detail)
  const editCopy = useCopy(gstInvoiceEditContent.card)
  const [emailing, setEmailing] = useState(false)
  const [editing, setEditing] = useState(false)

  // Event handlers
  const handleEmail = async () => {
    if (!buyerEmail) return
    setEmailing(true)
    const id = toast.loading(copy.sending)
    try {
      const queued = await api.gstInvoices.bulkEmail({ ids: [invoiceId] })
      if (queued.total === 0) {
        toast.error(copy.failed, { id })
        return
      }
      for (let i = 0; i < POLL_TRIES; i += 1) {
        await wait(POLL_MS)
        const b = await api.gstInvoices.batch({ id: queued.batchId })
        if (b.sent > 0) {
          toast.success(copy.sent(buyerEmail), { id })
          return
        }
        if (b.failed > 0) {
          toast.error(copy.failed, { id, description: b.errors[0] })
          return
        }
      }
      // The worker is busy: the job still runs, and the order's timeline notes the send.
      toast.success(copy.queued, { id })
    } catch (err) {
      toast.error(errorText(err, copy.failed), { id })
    } finally {
      setEmailing(false)
    }
  }

  const handleSaved = () => {
    setEditing(false)
    onEdited()
  }

  // Render logic
  const lock = edit?.lock
  /** A credit note, a queued draft or another document has nothing to edit. */
  const canHaveEdit =
    lock !== undefined && lock.reason !== 'not_tax_invoice' && lock.reason !== 'not_issued'
  const editNote = !lock
    ? null
    : lock.editable
      ? lock.dueDate
        ? copy.editUntil(formatDate(lock.dueDate))
        : null
      : lockText(editCopy.locked, lock)
  const emailButton = (
    <Button
      disabled={!buyerEmail || busy !== null || emailing}
      onClick={handleEmail}
      loading={emailing}
    >
      <Send />
      {copy.email}
    </Button>
  )

  return (
    <>
      {/* 1rem before the ⋯ menu with the row's gap, as on every GST page header. */}
      <span className="mr-2 inline-flex">
        {buyerEmail ? (
          emailButton
        ) : (
          // A disabled button gets no pointer events, so the tip hangs on a wrapper.
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{emailButton}</TooltipTrigger>
            <TooltipContent>{copy.noEmail}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <ActionMenu
        label={copy.more}
        variant="outline"
        size="md"
        disabled={busy !== null || emailing}
        loading={busy === 'print' || busy === 'download'}
        contentClassName="min-w-56"
        items={[
          {
            label: copy.edit,
            icon: Pencil,
            description: editNote,
            disabled: !lock?.editable,
            hidden: !canHaveEdit,
            onSelect: () => setEditing(true),
          },
          { label: detailCopy.print, icon: Printer, onSelect: onPrint },
          { label: detailCopy.download, icon: Download, onSelect: onDownload },
        ]}
      />
      {editing && edit ? (
        <InvoiceEditSheet
          invoiceId={invoiceId}
          orderId={orderId}
          number={number}
          snapshot={snapshot}
          start={edit.form}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
