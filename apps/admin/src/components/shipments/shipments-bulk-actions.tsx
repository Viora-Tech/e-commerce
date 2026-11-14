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
import { pickupRefusal, startingPickupPlan } from './create-shipment/pickup-plan'
import LabelPaperSelect from './label-paper-select'
import PickupFields, { type PickupValue } from './pickup-fields'
import { useLabelSheet } from './use-label-sheet'

type ShipmentsBulkActionsProps = {
  /** Selected shipment ids (never "To book" orders: that tab books them instead). */
  ids: string[]
  tab: Exclude<ShipmentTab, 'toBook'>
  /** After a pickup or manifest: clear the selection and read the rows again. */
  onDone: () => void
}

type Dialog = 'pickup' | 'manifest' | null

/**
 * The selection bar on the booked tabs: print the selected labels as one file on the paper
 * picked, and while parcels wait for the courier (Booked), schedule their pickup or group them
 * into a manifest. Both ask first.
 */
export default function ShipmentsBulkActions({ ids, tab, onDone }: ShipmentsBulkActionsProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const actions = useCopy(shipmentActionsContent)
  const sheet = useLabelSheet()
  const [dialog, setDialog] = useState<Dialog>(null)
  // Starts on a day (today, or tomorrow from noon), so the request can go straight away.
  const [pickup, setPickup] = useState<PickupValue>(() => ({
    date: startingPickupPlan().date,
    timeFrom: '14:00',
    timeTo: '',
    joinPickupId: null,
  }))

  // Helpers
  const fail = (err: unknown) => {
    toast.error(err instanceof Error && err.message ? err.message : actions.failed)
    throw err
  }

  // Event handlers
  const handlePickup = async () => {
    let pickups: Awaited<ReturnType<typeof api.shipments.schedulePickup>>
    try {
      // One step (owner, 10 Nov 2026): the courier's pickup request, then its manifest; the
      // labels move to To be picked up.
      pickups = await api.shipments.schedulePickup({
        shipmentIds: ids,
        date: pickup.date,
        timeFrom: pickup.timeFrom.trim(),
        timeTo: pickup.timeTo.trim() || undefined,
        joinPickupId: pickup.joinPickupId ?? undefined,
      })
      for (const made of pickups) {
        if (made.status === 'failed') continue
        await api.shipments.createManifest({ pickupId: made.id }).catch(() => undefined)
      }
    } catch (err) {
      return fail(err)
    }
    /* A courier's refusal is recorded as a failed pickup, not thrown: say so in its words and
       keep the dialog open. Parcels another courier or place took have moved on, so re-read. */
    const refused = pickupRefusal(pickups, actions.pickupRefused)
    if (refused) {
      toast.error(refused)
      if (pickups.some((p) => p.status !== 'failed')) onDone()
      throw new Error(refused)
    }
    toast.success(
      pickup.joinPickupId
        ? actions.joinedDone(ids.length)
        : actions.pickupAndManifestDone(ids.length),
    )
    onDone()
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
      <LabelPaperSelect value={sheet.format} onChange={sheet.setFormat} size="sm" />
      <Button
        size="sm"
        variant="outline"
        disabled={sheet.printing}
        onClick={() => void sheet.print(ids)}
      >
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
