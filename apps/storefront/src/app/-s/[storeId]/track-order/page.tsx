import type { Metadata } from 'next'
import TrackOrderForm from '@/components/track-order/track-order-form'
import { trackOrderContent as copy } from '@/data/track-order'

export const metadata: Metadata = {
  title: copy.metaTitle,
  alternates: { canonical: '/track-order' },
}

/** Guest order lookup: the order number and its email or mobile open the order's status page. */
export default function TrackOrderPage() {
  return (
    <section className="page-width track-order-page">
      <TrackOrderForm />
    </section>
  )
}
