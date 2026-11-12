'use client'

import { useEffect } from 'react'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import OrderView from '@/components/orders/order-view'
import CreateShipmentPage from '@/components/shipments/create-shipment/create-shipment-page'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ShipmentOrderProps = {
  order: OrderDetail
  appCards: string[]
  /** A parcel still to book (a To book row's Part 2): Create shipment for it. */
  parcel?: string | undefined
}

/**
 * An order opened from Shipments. Figma has no page for one shipment, so an order still to book
 * opens Create shipment and a booked one opens the order at its shipment card; both go Back to
 * Shipments, and the sidebar keeps Shipments lit.
 */
export default function ShipmentOrder({ order, appCards, parcel }: ShipmentOrderProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  useEffect(() => {
    if (order.shipment && order.shipment.status !== 'cancelled') {
      document.getElementById('order-shipment')?.scrollIntoView({ block: 'start' })
    }
  }, [order.shipment])

  // Render logic
  const back = { label: copy.title, href: routes.orders.shipments() }
  /* Part 1 booked does not mean the order is: a part with no label of its own still books. */
  const partToBook = order.partShipping?.parcels.some((p) => p.id === parcel && !p.shipment)
  const booked = order.shipment !== null && order.shipment.status !== 'cancelled' && !partToBook

  if (booked) return <OrderView order={order} appCards={appCards} back={back} />
  return <CreateShipmentPage orderId={order.id} back={back} parcel={parcel} />
}
