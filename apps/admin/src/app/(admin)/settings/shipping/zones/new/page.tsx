import type { Metadata } from 'next'
import ZoneForm from '@/components/shipping-zones/zone-form'

export const metadata: Metadata = { title: 'Create shipping zone' }

export default function NewShippingZonePage() {
  return <ZoneForm zone={null} />
}
