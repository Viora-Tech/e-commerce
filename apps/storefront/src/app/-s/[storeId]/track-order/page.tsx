import type { Metadata } from 'next'
import TrackOrderForm from '@/components/track-order/track-order-form'
import { trackOrderContent as copy } from '@/data/track-order'
import { marketCanonical } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy.metaTitle, alternates: { canonical: await marketCanonical('/track-order') } }
}

/** Guest order lookup: the order number and its email or mobile open the order's status page. */
export default function TrackOrderPage() {
  return (
    <section className="page-width track-order-page">
      <TrackOrderForm />
    </section>
  )
}
