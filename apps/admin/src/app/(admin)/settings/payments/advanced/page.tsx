import type { Metadata } from 'next'
import AdvancedPayments from './advanced-payments'

export const metadata: Metadata = { title: 'Advanced payments' }

export default function Page() {
  return <AdvancedPayments />
}
