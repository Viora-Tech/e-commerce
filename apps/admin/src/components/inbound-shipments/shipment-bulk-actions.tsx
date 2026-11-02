'use client'

import { ChevronDown, PackageCheck, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  inboundShipmentsContent,
} from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type ShipmentBulkActionsProps = {
  ids: string[]
  /** After a change: clear the selection and reload. */
  onDone: () => void
}

type Stage = Exclude<InboundShipmentStatus, 'delivered'>

/** The stages a merchant can move shipments to by hand; delivered goes through receiving. */
const STAGES = INBOUND_SHIPMENT_STATUSES.filter((s): s is Stage => s !== 'delivered')

/**
 * The inbound shipments list's selection bar (#1045, #1055): mark them delivered (receives what's
 * outstanding, like the shipment page), move them to another stage, or delete empty ones. Each
 * runs per shipment, so the server's rules decide and refusals count as failed in the toast.
 */
export default function ShipmentBulkActions({ ids, onDone }: ShipmentBulkActionsProps) {
  // Hooks
  const copy = useCopy(inboundShipmentsContent)
  const shared = useCopy(bulkActionsContent)
  const [confirming, setConfirming] = useState<'deliver' | 'delete' | null>(null)

  // Event handlers
  const handleStatus = async (status: Stage) => {
    const outcome = await runBatched(ids, (id) => api.inboundShipments.setStatus({ id, status }))
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  const handleConfirm = async () => {
    const outcome = await runBatched(ids, async (id) => {
      if (confirming === 'deliver') await api.inboundShipments.receive({ id })
      else await api.inboundShipments.delete({ id })
    })
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  // Render logic
  const dialog = confirming === 'deliver' ? copy.bulk.confirmDeliver : copy.bulk.confirmDelete

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirming('deliver')}>
        <PackageCheck aria-hidden="true" />
        {copy.bulk.deliver}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {copy.bulk.changeStatus}
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STAGES.map((stage) => (
            <DropdownMenuItem key={stage} onClick={() => void handleStatus(stage)}>
              {copy.status[stage]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" onClick={() => setConfirming('delete')}>
        <Trash2 aria-hidden="true" />
        {copy.bulk.delete}
      </Button>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={dialog.title(ids.length)}
        body={dialog.body}
        confirmLabel={dialog.confirm}
        cancelLabel={copy.bulk.keep}
        tone={confirming === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirm}
      />
    </>
  )
}
