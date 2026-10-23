'use client'

import type { ShipmentTab } from '@commerce/core/shipment-tabs'
import { FileText, Printer, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shipmentActionsContent, shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

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
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState('14:00')
  const [timeTo, setTimeTo] = useState('')

  // Helpers
  const fail = (err: unknown) => {
    toast.error(err instanceof Error && err.message ? err.message : actions.failed)
    throw err
  }

  // Event handlers
  const handlePickup = async () => {
    try {
      await api.shipments.schedulePickup({
        shipmentIds: ids,
        date,
        timeFrom,
        timeTo: timeTo || undefined,
      })
      toast.success(actions.pickupDone(ids.length))
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
        <>
          <Button size="sm" variant="outline" onClick={() => setDialog('pickup')}>
            <Truck aria-hidden />
            {actions.schedulePickup}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('manifest')}>
            <FileText aria-hidden />
            {actions.createManifest}
          </Button>
        </>
      ) : null}
      <ConfirmDialog
        open={dialog === 'pickup'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={actions.pickupTitle(ids.length)}
        body={actions.pickupBody}
        confirmLabel={copy.pickups.submit}
        tone="default"
        confirmDisabled={!date || !timeFrom}
        onConfirm={handlePickup}
      >
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="bulk-pickup-date">{actions.date}</FieldLabel>
            <Input
              id="bulk-pickup-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bulk-pickup-from">{actions.timeFrom}</FieldLabel>
            <Input
              id="bulk-pickup-from"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bulk-pickup-to">{actions.timeTo}</FieldLabel>
            <Input id="bulk-pickup-to" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
          </Field>
        </div>
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
