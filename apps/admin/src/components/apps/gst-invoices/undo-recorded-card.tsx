'use client'

import { Undo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type UndoRecordedCardProps = {
  /** The invoice recorded with "Already invoiced" (`source` external). */
  invoiceId: string
  number: string
  /** Another action on the page is running. */
  disabled: boolean
}

/**
 * Undo "Already invoiced" on the invoice page: after a confirm the record becomes a queued
 * draft again and the page goes to the Queue. The server refuses it once the month is filed.
 */
export default function UndoRecordedCard({ invoiceId, number, disabled }: UndoRecordedCardProps) {
  // Hooks
  const copy = useCopy(gstAlreadyInvoicedContent)
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    try {
      await api.gstInvoices.queue.undoExternal({ id: invoiceId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.undoFailed)
      throw err
    }
    toast.success(copy.undone(number))
    router.push(routes.apps.page('gst-invoices'))
    // The sidebar's Queue count comes from the server layout: read it again too.
    router.refresh()
  }

  return (
    <DataCard bodyClassName="flex flex-col" title={copy.undoTitle}>
      <p className="text-body text-muted-foreground">{copy.undoBody}</p>
      <Button
        className="mt-3 self-start"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Undo aria-hidden="true" />
        {copy.undo}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.undoConfirmTitle(number)}
        body={copy.undoConfirmBody}
        confirmLabel={copy.undo}
        tone="destructive"
        onConfirm={handleConfirm}
      />
    </DataCard>
  )
}
