'use client'

import { lostActions } from '@commerce/core/shipment-lost-state'
import {
  AppWindow,
  CancelCircle,
  FileText,
  PackageCheck,
  PackageX,
  Printer,
  RefreshCw,
  Truck,
} from '@commerce/ui/icons'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import RowMenu from '@/components/table/row-menu'
import { shipmentLostContent } from '@/data/shipment-lost'
import { shipmentActionsContent, shipmentCancelContent, shipmentsContent } from '@/data/shipments'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import ShipmentCancelDialog from './shipment-cancel-dialog'
import type { ShipmentRow } from './shipment-columns'
import ShipmentDetailsLoader from './shipment-details-loader'
import ShipmentLostDialogs, { type LostDialog } from './shipment-lost-dialogs'

type ShipmentRowMenuProps = {
  row: ShipmentRow
  /** The table reads its rows (and the tab counts) again after a change. */
  onChanged: () => void
}

/** At the store or on its way: the Cancel popup has a way out for each (`ShipmentCancelDialog`). */
const CANCELLABLE = ['created', 'picked_up', 'in_transit', 'out_for_delivery']
/** Out of the courier's hands: nothing left to track. */
const SETTLED = ['delivered', 'rto', 'cancelled']

/**
 * The ⋯ menu on a Shipments row: the shipment's details (in a centred dialog), open the order,
 * print the label, track the parcel, ask the courier for fresh tracking, and, while the parcel is
 * at the store or on its way, the Cancel popup (`ShipmentCancelDialog`): cancel the pickup or the
 * shipment, bring it back (RTO), or record a cancel made on the courier's own app.
 */
export default function ShipmentRowMenu({ row, onChanged }: ShipmentRowMenuProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const actions = useCopy(shipmentActionsContent)
  const cancelCopy = useCopy(shipmentCancelContent)
  const details = useCopy(shipmentDetailsContent)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const lostCopy = useCopy(shipmentLostContent)
  const [lostDialog, setLostDialog] = useState<LostDialog>(null)

  // Event handlers
  const handleRefresh = async () => {
    try {
      await api.orders.refreshTracking({ shipmentId: row.id })
      toast.success(actions.trackingUpdated)
      onChanged()
    } catch (err) {
      toast.error(errorText(err, actions.failed))
    }
  }

  // Render logic
  /* An order still to book has no shipment yet: only "View order" applies. */
  const booked = row.status !== null
  const trackable = booked && !SETTLED.includes(row.status ?? '')
  const cancellable = CANCELLABLE.includes(row.status ?? '')
  const lost = lostActions({ status: row.status ?? '', reshippedAt: row.lost?.reshippedAt ?? null })

  return (
    <>
      {/* To book, the menu held only "View order", which the row itself opens (audit #41). */}
      {booked ? (
        <RowMenu
          items={[
            {
              label: details.open,
              icon: PackageCheck,
              hidden: !booked,
              onSelect: () => setShowDetails(true),
            },
            {
              label: copy.menu.viewOrder,
              href: routes.orders.detail(row.orderId),
              icon: AppWindow,
            },
            {
              label: copy.menu.label,
              href: row.labelUrl ?? undefined,
              icon: Printer,
              newTab: true,
              hidden: !row.labelUrl || row.status === 'cancelled',
            },
            {
              label: copy.menu.track,
              href: row.trackingUrl ?? undefined,
              icon: Truck,
              newTab: true,
              hidden: !row.trackingUrl,
            },
            {
              label: actions.refreshTracking,
              icon: RefreshCw,
              hidden: !trackable,
              onSelect: handleRefresh,
            },
            {
              label: lostCopy.menu.reship,
              icon: Truck,
              hidden: !lost.reship,
              onSelect: () => setLostDialog('reship'),
            },
            {
              label: lostCopy.menu.claim,
              icon: FileText,
              hidden: !lost.claim,
              onSelect: () => setLostDialog('claim'),
            },
            {
              label: lostCopy.menu.markLost,
              icon: PackageX,
              destructive: true,
              separatorBefore: true,
              hidden: !lost.markLost,
              onSelect: () => setLostDialog('markLost'),
            },
            {
              label: cancelCopy.menu,
              icon: CancelCircle,
              destructive: true,
              separatorBefore: true,
              hidden: !cancellable,
              onSelect: () => setConfirmCancel(true),
            },
          ]}
        />
      ) : null}
      {cancellable && confirmCancel ? (
        <ShipmentCancelDialog
          open
          onOpenChange={setConfirmCancel}
          shipmentId={row.id}
          waybill={row.waybill ?? ''}
          status={row.status ?? 'created'}
          onPickup={Boolean(row.onPickup)}
          courierCancels={row.courierCancels}
          onDone={onChanged}
        />
      ) : null}
      {booked && row.lost ? (
        <ShipmentLostDialogs
          shipmentId={row.id}
          info={row.lost}
          open={lostDialog}
          onOpenChange={setLostDialog}
          onChanged={onChanged}
        />
      ) : null}
      {booked ? (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent
            // Inside a clickable row: a click in the dialog must not open the row too.
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>{details.heading}</DialogTitle>
            </DialogHeader>
            {showDetails ? (
              <ShipmentDetailsLoader shipmentId={row.id} onChanged={onChanged} />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
