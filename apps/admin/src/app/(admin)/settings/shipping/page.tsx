import type { Metadata } from 'next'
import ShippingPage from '@/components/shipping-settings/shipping-page'

export const metadata: Metadata = { title: 'Shipping' }

export default function Page() {
  return <ShippingPage />
}
