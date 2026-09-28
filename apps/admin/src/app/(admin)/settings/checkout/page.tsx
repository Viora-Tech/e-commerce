import type { Metadata } from 'next'
import CheckoutSettings from '@/components/settings/checkout-settings'

export const metadata: Metadata = { title: 'Checkout' }

export default function Page() {
  return <CheckoutSettings />
}
