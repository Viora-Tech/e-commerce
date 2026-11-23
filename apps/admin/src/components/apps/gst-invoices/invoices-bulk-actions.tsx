'use client'

import { Download, Printer, RefreshCw, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { gstInvoiceBulkRefreshContent } from '@/data/gst-invoice-refresh'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { saveFile } from './save-file'

type InvoicesBulkActionsProps = {
  /** The ticked documents (or every one the filter matches, after "Select all"). */
  ids: string[]
  /** Recalculate GST is for tax invoices only. */
  taxInvoices: boolean
  /** Printing or downloading clears "Not printed": the list reads its rows again. */
  onChanged: () => void
  /** An email batch was queued: the page polls its progress. */
  onEmailQueued: (batch: { batchId: string; total: number }) => void
}

/** The Invoices bulk bar's buttons: zip of PDFs, one PDF to print, Recalculate GST, email. */
export default function InvoicesBulkActions({
  ids,
  taxInvoices,
  onChanged,
  onEmailQueued,
}: InvoicesBulkActionsProps) {
  // Hooks
  const copy = useCopy(gstInvoicesContent.list)
  const refreshCopy = useCopy(gstInvoiceBulkRefreshContent)
  const [busy, setBusy] = useState<string | null>(null)

  // Helpers
  const run = async (action: string, fn: () => Promise<void>) => {
    setBusy(action)
    const id = toast.loading(copy.working)
    try {
      await fn()
      toast.dismiss(id)
    } catch (err) {
      toast.error(errorText(err, copy.failed), { id })
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleDownload = () =>
    run('download', async () => {
      saveFile(await api.gstInvoices.bulkDownload({ ids }))
      onChanged()
    })
  const handlePrint = () =>
    run('print', async () => {
      saveFile(await api.gstInvoices.bulkPrint({ ids }), 'open')
      onChanged()
    })
  const handleRecalculate = () =>
    run('recalculate', async () => {
      const r = await api.gstInvoices.bulkRefreshGst({ ids })
      toast.success(refreshCopy.done(r.updated, r.unchanged, r.skipped))
      onChanged()
    })
  const handleEmail = () =>
    run('email', async () => {
      const r = await api.gstInvoices.bulkEmail({ ids })
      onEmailQueued(r)
      toast.success(copy.emailQueued(r.total))
    })

  // Render logic
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={handleDownload}
        loading={busy === 'download'}
      >
        <Download />
        {copy.download}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={handlePrint}
        loading={busy === 'print'}
      >
        <Printer />
        {copy.print}
      </Button>
      {taxInvoices ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={handleRecalculate}
          loading={busy === 'recalculate'}
        >
          <RefreshCw />
          {refreshCopy.button}
        </Button>
      ) : null}
      <Button size="sm" disabled={busy !== null} onClick={handleEmail} loading={busy === 'email'}>
        <Send />
        {copy.email}
      </Button>
    </>
  )
}
