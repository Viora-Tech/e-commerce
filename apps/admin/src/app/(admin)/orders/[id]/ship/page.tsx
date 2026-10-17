import type { Metadata } from 'next'
import CreateShipmentPage from '@/components/shipments/create-shipment/create-shipment-page'

import { createShipmentContent } from '@/data/create-shipment'
export const metadata: Metadata = { title: createShipmentContent.page.title }

type Params = { params: Promise<{ id: string }> }

/** Orders › #1042 › Create shipment (Figma 616:16737). */
export default async function ShipOrderPage({ params }: Params) {
  const { id } = await params
  return <CreateShipmentPage orderId={id} />
}
