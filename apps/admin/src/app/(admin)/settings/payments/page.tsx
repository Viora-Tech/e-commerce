import type { Metadata } from 'next'
import { PaymentsSettings } from './payments-settings'

export const metadata: Metadata = { title: 'Payments' }

export default function Page() {
  return <PaymentsSettings />
}
