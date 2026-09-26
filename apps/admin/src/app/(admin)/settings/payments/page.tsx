import type { Metadata } from 'next'
import { Suspense } from 'react'
import PaymentsPage from '@/components/payments/payments-page'

export const metadata: Metadata = { title: 'Payments' }

export default function Page() {
  return (
    <Suspense>
      <PaymentsPage />
    </Suspense>
  )
}
