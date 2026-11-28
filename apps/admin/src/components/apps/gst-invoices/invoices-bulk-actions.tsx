'use client'

import { Download, Printer, RefreshCw, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { gstInvoiceActionsContent } from '@/data/gst-invoice-actions'
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

/**
 * The Invoices bulk bar's actions (owner, 28 Nov 2026): Email to buyers as the one main button,
 * then a ⋯ menu with the zip of PDFs, one PDF to print and Recalculate GST (tax invoices only).
 */
export default function InvoicesBulkActions({
  ids,
  taxInvoices,
  onChanged,
  onEmailQueued,
}: InvoicesBulkActionsProps) {
  // Hooks
  const copy = useCopy(gstInvoicesContent.list)
  const refreshCopy = useCopy(gstInvoiceBulkRefreshContent)
  const actionsCopy = useCopy(gstInvoiceActionsContent.bulk)
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
      <Button size="sm" disabled={busy !== null} onClick={handleEmail} loading={busy === 'email'}>
        <Send />
        {copy.email}
      </Button>
      <ActionMenu
        label={actionsCopy.more}
        variant="outline"
        disabled={busy !== null}
        loading={busy !== null && busy !== 'email'}
        items={[
          { label: copy.download, icon: Download, onSelect: handleDownload },
          { label: copy.print, icon: Printer, onSelect: handlePrint },
          {
            label: refreshCopy.button,
            icon: RefreshCw,
            onSelect: handleRecalculate,
            hidden: !taxInvoices,
          },
        ]}
      />
    </>
  )
}
