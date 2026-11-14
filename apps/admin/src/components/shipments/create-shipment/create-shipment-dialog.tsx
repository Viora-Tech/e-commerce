'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { shipmentHref } from '@/apps/order-actions'
import { routes } from '@/lib/routes'
import BulkShipDrawer from './bulk-ship-drawer'

type CreateShipmentDialogProps = {
  /** The orders to ship. Several open the bulk ship drawer (Figma 908:8804); one opens that
   *  order's Create shipment page. */
  orderIds: string[]
  /** A courier's provider id to start on (a courier app's Create shipment). */
  courier?: string | undefined
  onClose: () => void
  /** After a booking, so the page behind reloads (order status, Shipments tabs). */
  onBooked: () => void
}

/**
 * Create shipment from a list: one surface per job (audit 3.3 #7). One order goes to its Create
 * shipment page (Figma 616:16737), the same page the order page and Shipments open; several open
 * the bulk ship drawer. The 42rem single-order dialog that used to sit here is gone.
 */
export default function CreateShipmentDialog({
  orderIds,
  courier,
  onClose,
  onBooked,
}: CreateShipmentDialogProps) {
  // Hooks
  const router = useRouter()
  // One order: hand it to its page (with the courier, when a courier app asked for one).
  useEffect(() => {
    const only = orderIds.length === 1 ? orderIds[0] : undefined
    if (!only) return
    router.push(courier ? shipmentHref(only, courier) : routes.orders.ship(only))
    onClose()
  }, [orderIds, courier, router, onClose])

  return (
    <BulkShipDrawer orderIds={orderIds} courier={courier} onClose={onClose} onBooked={onBooked} />
  )
}
