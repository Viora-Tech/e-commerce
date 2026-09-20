import type { Metadata } from 'next'
import { OrdersPage } from './orders-page'

export const metadata: Metadata = { title: 'Orders' }

export default function Page() {
  return <OrdersPage />
}
