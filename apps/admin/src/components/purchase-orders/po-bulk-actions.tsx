'use client'

import { CircleCheck, Download, Send, Trash2, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { purchaseOrderBulkContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type PoBulkActionsProps = {
  ids: string[]
  /** After a change: clear the selection and reload. */
  onDone: () => void
}

type Confirming = 'close' | 'cancel' | 'delete' | null

/**
 * The purchase order list's selection bar: each order's PDF, mark drafts as ordered, close,
 * cancel or delete them. Every action runs per order through the same API the order page uses,
 * so an order the action does not fit (a draft can't close, a received order can't cancel) is
 * refused by the server and counted as failed in the summary toast (#1061).
 */
export default function PoBulkActions({ ids, onDone }: PoBulkActionsProps) {
  // Hooks
  const copy = useCopy(purchaseOrderBulkContent)
  const shared = useCopy(bulkActionsContent)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [downloading, setDownloading] = useState(false)
  const [ordering, setOrdering] = useState(false)

  // Event handlers
  const handleDownload = async () => {
    setDownloading(true)
    const outcome = await runBatched(ids, async (id) =>
      saveFile(await api.purchaseOrders.pdf({ id }), 'download'),
    )
    setDownloading(false)
    toastOutcome(outcome, shared.summary)
  }

  /* Only drafts with lines can be marked ordered; the rest count as failed. */
  const handleMarkOrdered = async () => {
    setOrdering(true)
    const outcome = await runBatched(ids, (id) => api.purchaseOrders.markOrdered({ id }))
    setOrdering(false)
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  const handleConfirm = async () => {
    if (!confirming) return
    const call = {
      close: api.purchaseOrders.close,
      cancel: api.purchaseOrders.cancel,
      delete: api.purchaseOrders.delete,
    }[confirming]
    const outcome = await runBatched(ids, (id) => call({ id }))
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  // Render logic
  const dialog = confirming ? copy.confirm[confirming] : null

  return (
    <>
      <Button variant="outline" size="sm" loading={downloading} onClick={handleDownload}>
        <Download aria-hidden="true" />
        {copy.downloadPdfs}
      </Button>
      <Button variant="outline" size="sm" loading={ordering} onClick={handleMarkOrdered}>
        <Send aria-hidden="true" />
        {copy.markOrdered}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming('close')}>
        <CircleCheck aria-hidden="true" />
        {copy.close}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming('cancel')}>
        <X aria-hidden="true" />
        {copy.cancelOrders}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming('delete')}>
        <Trash2 aria-hidden="true" />
        {copy.delete}
      </Button>
      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={dialog?.title(ids.length) ?? ''}
        body={dialog?.body ?? ''}
        confirmLabel={dialog?.confirm ?? ''}
        cancelLabel={copy.keep}
        tone={confirming === 'close' ? 'default' : 'destructive'}
        onConfirm={handleConfirm}
      />
    </>
  )
}
