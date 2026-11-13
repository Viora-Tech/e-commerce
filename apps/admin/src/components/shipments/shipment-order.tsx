'use client'

import { useEffect, useState } from 'react'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import OrderView from '@/components/orders/order-view'
import CreateShipmentPage from '@/components/shipments/create-shipment/create-shipment-page'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ShipmentOrderProps = {
  order: OrderDetail
  appCards: string[]
}

/**
 * An order opened from Shipments. Figma has no page for one shipment, so an order still to book
 * opens Create shipment and a booked one opens the order at its shipment card; both go Back to
 * Shipments, and the sidebar keeps Shipments lit.
 */
export default function ShipmentOrder({ order, appCards }: ShipmentOrderProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  /* Opened to book: stay on Create shipment after booking, so its Booked drawer (Figma
     905:7783) shows over the booked parcel instead of the page swapping to the order. The next
     visit opens the order at its shipment card. */
  const [creating] = useState(
    () => order.shipment === null || order.shipment.status === 'cancelled',
  )
  useEffect(() => {
    if (order.shipment && order.shipment.status !== 'cancelled') {
      document.getElementById('order-shipment')?.scrollIntoView({ block: 'start' })
    }
  }, [order.shipment])

  // Render logic
  const back = { label: copy.title, href: routes.orders.shipments() }
  const booked = order.shipment !== null && order.shipment.status !== 'cancelled'

  if (booked && !creating) return <OrderView order={order} appCards={appCards} back={back} />
  return <CreateShipmentPage orderId={order.id} back={back} />
}
