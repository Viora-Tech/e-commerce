'use client'

import {
  AppWindow,
  CancelCircle,
  PackageCheck,
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
import { shipmentActionsContent, shipmentCancelContent, shipmentsContent } from '@/data/shipments'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ShipmentCancelDialog from './shipment-cancel-dialog'
import type { ShipmentRow } from './shipment-columns'
import ShipmentDetailsLoader from './shipment-details-loader'

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

  // Event handlers
  const handleRefresh = async () => {
    try {
      await api.orders.refreshTracking({ shipmentId: row.id })
      toast.success(actions.trackingUpdated)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : actions.failed)
    }
  }

  // Render logic
  /* An order still to book has no shipment yet: only "View order" applies. */
  const booked = row.status !== null
  const trackable = booked && !SETTLED.includes(row.status ?? '')
  const cancellable = CANCELLABLE.includes(row.status ?? '')

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
