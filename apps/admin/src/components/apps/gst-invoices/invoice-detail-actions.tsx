'use client'

import { Download, Printer, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { gstInvoiceActionsContent } from '@/data/gst-invoice-actions'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type InvoiceDetailActionsProps = {
  invoiceId: string
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
 * button, Print and Download PDF in the ⋯ menu. The email goes through the Invoices list's bulk
 * Email (`gstInvoices.bulkEmail`) with this one invoice, so it is the same `document_copy` email
 * and job; the page then watches the batch to say whether it was sent.
 */
export default function InvoiceDetailActions({
  invoiceId,
  buyerEmail,
  busy,
  onPrint,
  onDownload,
}: InvoiceDetailActionsProps) {
  // Hooks
  const copy = useCopy(gstInvoiceActionsContent.detail)
  const detailCopy = useCopy(gstInvoicesContent.detail)
  const [emailing, setEmailing] = useState(false)

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

  // Render logic
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
      {buyerEmail ? (
        emailButton
      ) : (
        // A disabled button gets no pointer events, so the tip hangs on a wrapper.
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>{emailButton}</TooltipTrigger>
          <TooltipContent>{copy.noEmail}</TooltipContent>
        </Tooltip>
      )}
      <ActionMenu
        label={copy.more}
        variant="outline"
        size="md"
        disabled={busy !== null || emailing}
        loading={busy === 'print' || busy === 'download'}
        items={[
          { label: detailCopy.print, icon: Printer, onSelect: onPrint },
          { label: detailCopy.download, icon: Download, onSelect: onDownload },
        ]}
      />
    </>
  )
}
