import { listCustomerOrders } from '@commerce/core'
import type { Metadata } from 'next'
import AccountFrame from '@/components/account/account-frame'
import RecentOrders from '@/components/track-order/recent-orders'
import TrackOrderForm from '@/components/track-order/track-order-form'
import { RECENT_ORDERS_LIMIT, trackOrderContent as copy } from '@/data/track-order'
import { storeTimeZone } from '@/lib/account'
import { currentCustomer } from '@/lib/customer-session'
import { marketCanonical } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type TrackOrderPageProps = { params: Promise<{ storeId: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy.metaTitle, alternates: { canonical: await marketCanonical('/track-order') } }
}

/**
 * Guest order lookup: the order number and its email or mobile open the order's status page.
 * A signed-in shopper with orders also sees their latest ones above it ("Track another order"
 * below), as Shopify's order status lookup does. Reading the session cookie keeps this page a
 * per-request render with Next's private, no-store answer, and `lib/edge-cache.ts` never lets a
 * CDN keep it (not a shared page, and a `wc_customer` cookie is personal).
 */
export default async function TrackOrderPage({ params }: TrackOrderPageProps) {
  const { storeId } = await params
  const me = await currentCustomer(storeId)
  const recent = me
    ? await inStore(storeId, async (tx) => ({
        orders: await listCustomerOrders({ storeId, tx }, me.id, { limit: RECENT_ORDERS_LIMIT }),
        timeZone: await storeTimeZone(tx, storeId),
      }))
    : null

  // A signed-in shopper without orders yet sees the lookup alone, minus "Sign in".
  if (!recent || recent.orders.length === 0) {
    return (
      <section className="page-width track-order-page">
        <TrackOrderForm signedIn={Boolean(me)} />
      </section>
    )
  }
  return (
    <AccountFrame storeId={storeId}>
      <div className="mx-auto! flex max-w-[40rem] flex-col gap-10">
        <RecentOrders orders={recent.orders} timeZone={recent.timeZone} />
        <TrackOrderForm another signedIn />
      </div>
    </AccountFrame>
  )
}
