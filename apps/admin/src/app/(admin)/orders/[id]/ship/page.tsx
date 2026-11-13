import type { Metadata } from 'next'
import CreateShipmentPage from '@/components/shipments/create-shipment/create-shipment-page'

import { createShipmentContent } from '@/data/create-shipment'
export const metadata: Metadata = { title: createShipmentContent.page.title }

type Params = {
  params: Promise<{ id: string }>
  /** `courier`: a courier app's "Create shipment" starts the page on that courier. */
  searchParams: Promise<{ courier?: string | string[]; parcel?: string | string[] }>
}

/** Orders › #1042 › Create shipment (Figma 616:16737). */
export default async function ShipOrderPage({ params, searchParams }: Params) {
  const { id } = await params
  const { courier, parcel } = await searchParams
  return (
    <CreateShipmentPage
      orderId={id}
      courier={typeof courier === 'string' ? courier : undefined}
      parcel={typeof parcel === 'string' ? parcel : undefined}
    />
  )
}
