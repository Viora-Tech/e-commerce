'use client'

import { CircleCheck, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { purchaseOrderBulkContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type PoBulkActionsProps = {
  ids: string[]
  /** After a change: clear the selection and reload. */
  onDone: () => void
}

/** The purchase order list's selection bar: each order's PDF, or close them all. */
export default function PoBulkActions({ ids, onDone }: PoBulkActionsProps) {
  // Hooks
  const copy = useCopy(purchaseOrderBulkContent)
  const shared = useCopy(bulkActionsContent)
  const [closing, setClosing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Event handlers
  const handleDownload = async () => {
    setDownloading(true)
    const outcome = await runBatched(ids, async (id) =>
      saveFile(await api.purchaseOrders.pdf({ id }), 'download'),
    )
    setDownloading(false)
    toastOutcome(outcome, shared.summary)
  }

  /* Drafts and finished orders refuse to close; they count as failed in the summary. */
  const handleClose = async () => {
    const outcome = await runBatched(ids, (id) => api.purchaseOrders.close({ id }))
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  return (
    <>
      <Button variant="outline" size="sm" loading={downloading} onClick={handleDownload}>
        <Download aria-hidden="true" />
        {copy.downloadPdfs}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setClosing(true)}>
        <CircleCheck aria-hidden="true" />
        {copy.close}
      </Button>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={copy.confirmClose.title(ids.length)}
        body={copy.confirmClose.body}
        confirmLabel={copy.confirmClose.confirm}
        cancelLabel={copy.confirmClose.cancel}
        tone="default"
        onConfirm={handleClose}
      />
    </>
  )
}
