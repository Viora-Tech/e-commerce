import type { Metadata } from 'next'
import { ShippingSettings } from './shipping-settings'

export const metadata: Metadata = { title: 'Shipping' }

export default function Page() {
  return <ShippingSettings />
}
