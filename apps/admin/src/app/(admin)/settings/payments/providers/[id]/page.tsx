import type { Metadata } from 'next'
import ProviderPage from '@/components/payments/provider-page'

type Params = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Payments' }

/** Settings → Payments → one payment provider (Razorpay, Cashfree, Decentro UPI). */
export default async function Page({ params }: Params) {
  const { id } = await params
  return <ProviderPage providerId={id} />
}
