'use client'

import { AppWindow, CancelCircle, Printer, RefreshCw, Truck } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { ordersContent } from '@/data/orders'
import { shipmentActionsContent, shipmentsContent } from '@/data/shipments'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { ShipmentRow } from './shipment-columns'

type ShipmentRowMenuProps = {
  row: ShipmentRow
  /** The table reads its rows (and the tab counts) again after a change. */
  onChanged: () => void
}

/** Booked with the courier, not picked up yet: the booking can still be cancelled. */
const CANCELLABLE = 'created'
/** Out of the courier's hands: nothing left to track. */
const SETTLED = ['delivered', 'rto', 'cancelled']

/**
 * The ⋯ menu on a Shipments row: open the order, print the label, track the parcel, ask the
 * courier for fresh tracking, and cancel a booking that was not picked up yet (asks first).
 */
export default function ShipmentRowMenu({ row, onChanged }: ShipmentRowMenuProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const actions = useCopy(shipmentActionsContent)
  const list = useCopy(ordersContent)
  const panel = useCopy(shipmentPanelContent)
  const [confirmCancel, setConfirmCancel] = useState(false)

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

  const handleCancel = async () => {
    try {
      await api.orders.cancelShipment({ shipmentId: row.id })
      toast.success(panel.cancelled)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : actions.failed)
      throw err
    }
  }

  // Render logic
  /* An order still to book has no shipment yet: only "View order" applies. */
  const booked = row.status !== null
  const trackable = booked && !SETTLED.includes(row.status ?? '')

  return (
    <>
      <RowMenu
        items={[
          { label: copy.menu.viewOrder, href: routes.orders.detail(row.orderId), icon: AppWindow },
          {
            label: copy.menu.label,
            href: row.labelUrl ?? undefined,
            icon: Printer,
            newTab: true,
            hidden: !row.labelUrl,
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
            label: list.row.cancelShipment,
            icon: CancelCircle,
            destructive: true,
            separatorBefore: true,
            hidden: row.status !== CANCELLABLE,
            onSelect: () => setConfirmCancel(true),
          },
        ]}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={list.row.cancelShipmentTitle}
        body={list.row.cancelShipmentBody}
        confirmLabel={list.row.cancelShipmentConfirm}
        cancelLabel={list.row.keepShipment}
        stopPropagation
        onConfirm={handleCancel}
      />
    </>
  )
}
