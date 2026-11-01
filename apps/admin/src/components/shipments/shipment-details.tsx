'use client'

import { CancelCircle, ExternalLink, Pencil, Printer, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import OrderChip from '@/components/orders/order-chip'
import { editTrackingContent, shipmentDetailsContent } from '@/data/shipping'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PickupForm from './create-shipment/pickup-form'
import EditTrackingDialog from './edit-tracking-dialog'

/** A booked shipment as `shipments.get` (and the order's `shipment`) describe it. */
export type ShipmentDetailsData = Awaited<ReturnType<typeof api.shipments.get>>

type ShipmentDetailsProps = {
  shipment: ShipmentDetailsData
  /** After a cancel or a pickup request, so the page (or list) behind reads it again. */
  onChanged?: () => void
  /** Extra buttons beside Print label and Track (the order panel's Refresh tracking). */
  actions?: ReactNode
}

const HHMM = /^(\d{1,2}):(\d{2})$/

/**
 * The read-only details of a booked shipment: courier and service, the AWB to copy, status,
 * COD or prepaid, the package, the pickup, when it was booked, and the label, tracking and
 * Cancel shipment. Cancel asks first in a centred dialog; when it is not possible any more the
 * card says why instead. A parcel with no pickup request yet offers "Request pickup" inline.
 */
export default function ShipmentDetails({ shipment, onChanged, actions }: ShipmentDetailsProps) {
  // Hooks
  const copy = useCopy(shipmentDetailsContent)
  const editCopy = useCopy(editTrackingContent)
  const fmt = useFormat()
  const [confirming, setConfirming] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [editing, setEditing] = useState(false)

  // Event handlers
  const handleCancel = async () => {
    try {
      await api.orders.cancelShipment({ shipmentId: shipment.id })
      toast.success(copy.cancelled)
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.cancelFailed)
      throw err
    }
  }

  // Render logic
  // The rate row's name ("Delhivery Surface") when booked from the table, else the courier's.
  const courier = shipment.serviceLabel || shipment.providerLabel
  const payment =
    shipment.paymentMode === 'cod'
      ? shipment.codAmountPaise
        ? copy.cod(fmt.money(shipment.codAmountPaise))
        : copy.codNoAmount
      : shipment.paymentMode === 'prepaid'
        ? copy.prepaid
        : null
  const kg = shipment.weightGrams
    ? copy.weight(fmt.number(Math.round(shipment.weightGrams / 10) / 100))
    : null
  const size =
    shipment.lengthCm && shipment.widthCm && shipment.heightCm
      ? copy.size(shipment.lengthCm, shipment.widthCm, shipment.heightCm)
      : null
  const pkg = [kg, size].filter(Boolean).join(' · ')
  const time = shipment.pickup?.timeFrom.match(HHMM)
  const pickup = shipment.pickup
    ? copy.pickupOn(
        fmt.pattern(shipment.pickup.date, { weekday: 'short', day: 'numeric', month: 'short' }),
        time ? `${time[1]?.padStart(2, '0')}:${time[2]}` : shipment.pickup.timeFrom,
      )
    : shipment.status === 'created'
      ? copy.noPickup
      : null
  const block = shipment.cancelBlock

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate font-medium text-ink-strong">{courier}</p>
          <p className="flex items-center gap-1.5 text-body">
            <span className="text-muted-foreground">{copy.awb}</span>
            <code className="break-all text-ink-strong">{shipment.waybill}</code>
            <CopyButton value={shipment.waybill} what={copy.awb} visible />
          </p>
        </div>
        <OrderChip kind="shipment" value={shipment.status} />
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-body sm:grid-cols-2">
        {payment ? <Fact label={copy.payment}>{payment}</Fact> : null}
        {pkg ? <Fact label={copy.package}>{pkg}</Fact> : null}
        {pickup ? <Fact label={copy.pickup}>{pickup}</Fact> : null}
        {shipment.pickupLocationName ? (
          <Fact label={copy.pickupFrom}>{shipment.pickupLocationName}</Fact>
        ) : null}
        <Fact label={copy.created}>{fmt.dateTime(shipment.createdAt)}</Fact>
      </dl>

      {requesting ? (
        <PickupForm
          shipmentIds={[shipment.id]}
          onRequested={() => {
            setRequesting(false)
            onChanged?.()
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        {shipment.canRequestPickup && !requesting ? (
          <Button variant="outline" onClick={() => setRequesting(true)}>
            <Truck aria-hidden="true" />
            {copy.requestPickup}
          </Button>
        ) : null}
        {shipment.canEditTracking ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {editCopy.action}
          </Button>
        ) : null}
        {shipment.trackingUrl ? (
          <Button
            variant="outline"
            render={<a href={shipment.trackingUrl} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <ExternalLink aria-hidden="true" />
            {copy.track}
          </Button>
        ) : null}
        {shipment.labelUrl && shipment.status !== 'cancelled' ? (
          <Button
            variant="outline"
            render={<a href={shipment.labelUrl} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <Printer aria-hidden="true" />
            {copy.printLabel}
          </Button>
        ) : null}
        {block === null ? (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <CancelCircle aria-hidden="true" />
            {copy.cancel}
          </Button>
        ) : null}
      </div>
      {block !== null ? (
        <p className="text-caption text-muted-foreground">{copy.blocked[block]}</p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.cancelTitle}
        body={copy.cancelBody(shipment.providerLabel, shipment.waybill)}
        confirmLabel={copy.cancelConfirm}
        cancelLabel={copy.keep}
        onConfirm={handleCancel}
      />
      <EditTrackingDialog
        shipment={editing ? shipment : null}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onChanged?.()
        }}
      />
    </div>
  )
}

type FactProps = { label: string; children: ReactNode }

function Fact({ label, children }: FactProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="break-words text-ink-strong">{children}</dd>
    </div>
  )
}
