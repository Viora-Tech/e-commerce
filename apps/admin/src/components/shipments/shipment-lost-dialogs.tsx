'use client'

import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shipmentLostContent } from '@/data/shipment-lost'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import ShipmentClaimDialog from './shipment-claim-dialog'
import type { ShipmentLostInfo } from './shipment-columns'

/** Which lost-parcel popup is open on a row, if any. */
export type LostDialog = 'markLost' | 'reship' | 'claim' | null

type ShipmentLostDialogsProps = {
  shipmentId: string
  info: ShipmentLostInfo
  open: LostDialog
  onOpenChange: (open: LostDialog) => void
  onChanged: () => void
}

/**
 * The row menu's lost-parcel popups (owner, 18 Nov 2026): Mark as lost on a parcel the courier
 * has, Reship on a lost one (back to To ship, items leave stock again), and its courier claim.
 */
export default function ShipmentLostDialogs({
  shipmentId,
  info,
  open,
  onOpenChange,
  onChanged,
}: ShipmentLostDialogsProps) {
  // Hooks
  const copy = useCopy(shipmentLostContent)

  // Event handlers
  const run = async (call: () => Promise<unknown>, done: string) => {
    try {
      await call()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
      throw err
    }
  }
  const handleMarkLost = () => run(() => api.shipments.markLost({ shipmentId }), copy.markLost.done)
  const handleReship = () => run(() => api.shipments.reship({ shipmentId }), copy.reship.done)
  const handleOpen = (which: Exclude<LostDialog, null>) => (next: boolean) =>
    onOpenChange(next ? which : null)

  // Render logic
  return (
    <>
      <ConfirmDialog
        tone="destructive"
        open={open === 'markLost'}
        onOpenChange={handleOpen('markLost')}
        title={copy.markLost.title(info.waybill)}
        body={copy.markLost.body}
        confirmLabel={copy.markLost.confirm}
        cancelLabel={copy.markLost.keep}
        stopPropagation
        onConfirm={handleMarkLost}
      />
      <ConfirmDialog
        tone="default"
        open={open === 'reship'}
        onOpenChange={handleOpen('reship')}
        title={copy.reship.title(info.waybill)}
        body={copy.reship.body}
        confirmLabel={copy.reship.confirm}
        cancelLabel={copy.reship.keep}
        stopPropagation
        onConfirm={handleReship}
      />
      <ShipmentClaimDialog
        open={open === 'claim'}
        onOpenChange={handleOpen('claim')}
        shipmentId={shipmentId}
        waybill={info.waybill}
        claimStatus={info.claimStatus}
        claimAmountPaise={info.claimAmountPaise}
        claimNote={info.claimNote}
        onSaved={onChanged}
      />
    </>
  )
}
