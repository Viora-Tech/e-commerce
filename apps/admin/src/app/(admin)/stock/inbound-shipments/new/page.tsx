import type { Metadata } from 'next'
import ShipmentForm from '@/components/inbound-shipments/shipment-form'
import { inboundShipmentFormContent } from '@/data/purchasing'

export const metadata: Metadata = { title: inboundShipmentFormContent.newTitle }

export default function Page() {
  return <ShipmentForm shipment={null} costs={null} />
}
