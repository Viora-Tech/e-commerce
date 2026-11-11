'use client'

import type { ShipmentTab } from '@commerce/core/shipment-tabs'
import { FileText, Printer, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shipmentActionsContent, shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PickupFields, { type PickupValue } from './pickup-fields'

type ShipmentsBulkActionsProps = {
  /** Selected shipment ids (never "To book" orders: that tab books them instead). */
  ids: string[]
  tab: Exclude<ShipmentTab, 'toBook'>
  onPrint: (ids: string[]) => void
  /** After a pickup or manifest: clear the selection and read the rows again. */
  onDone: () => void
}

type Dialog = 'pickup' | 'manifest' | null

/**
 * The selection bar on the booked tabs: print the labels, and while parcels wait for the
 * courier (Booked), schedule their pickup or group them into a manifest. Both ask first.
 */
export default function ShipmentsBulkActions({
  ids,
  tab,
  onPrint,
  onDone,
}: ShipmentsBulkActionsProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const actions = useCopy(shipmentActionsContent)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pickup, setPickup] = useState<PickupValue>({
    date: '',
    timeFrom: '14:00',
    timeTo: '',
    joinPickupId: null,
  })

  // Helpers
  const fail = (err: unknown) => {
    toast.error(err instanceof Error && err.message ? err.message : actions.failed)
    throw err
  }

  // Event handlers
  const handlePickup = async () => {
    try {
      // One step (owner, 10 Nov 2026): the courier's pickup request, then its manifest; the
      // labels move to To be picked up.
      const pickups = await api.shipments.schedulePickup({
        shipmentIds: ids,
        date: pickup.date,
        timeFrom: pickup.timeFrom,
        timeTo: pickup.timeTo || undefined,
        joinPickupId: pickup.joinPickupId ?? undefined,
      })
      for (const pickup of pickups) {
        if (pickup.status === 'failed') continue
        await api.shipments.createManifest({ pickupId: pickup.id }).catch(() => undefined)
      }
      toast.success(
        pickup.joinPickupId
          ? actions.joinedDone(ids.length)
          : actions.pickupAndManifestDone(ids.length),
      )
      onDone()
    } catch (err) {
      fail(err)
    }
  }

  const handleManifest = async () => {
    try {
      await api.shipments.createManifest({ shipmentIds: ids })
      toast.success(actions.manifestDone)
      onDone()
    } catch (err) {
      fail(err)
    }
  }

  // Render logic
  const waiting = tab === 'booked'

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => onPrint(ids)}>
        <Printer aria-hidden />
        {copy.printLabels}
      </Button>
      {waiting ? (
        <Button size="sm" variant="outline" onClick={() => setDialog('pickup')}>
          <Truck aria-hidden />
          {actions.schedulePickup}
        </Button>
      ) : null}
      {tab === 'toPickUp' ? (
        <Button size="sm" variant="outline" onClick={() => setDialog('manifest')}>
          <FileText aria-hidden />
          {actions.createManifest}
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === 'pickup'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={actions.pickupTitle(ids.length)}
        body={actions.pickupBody}
        confirmLabel={pickup.joinPickupId ? actions.addToPickup : copy.pickups.submit}
        tone="default"
        confirmDisabled={!pickup.date || !pickup.timeFrom}
        onConfirm={handlePickup}
      >
        {dialog === 'pickup' ? (
          <PickupFields idPrefix="bulk-pickup" value={pickup} onChange={setPickup} />
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'manifest'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={actions.manifestTitle(ids.length)}
        body={actions.manifestBody}
        confirmLabel={actions.createManifest}
        tone="default"
        onConfirm={handleManifest}
      />
    </>
  )
}
