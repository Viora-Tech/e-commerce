import type { ShopperOrderSummary } from '@commerce/core'
import Link from 'next/link'
import AccountPageHead from '@/components/account/account-page-head'
import OrderList from '@/components/account/order-list'
import { trackOrderContent as copy } from '@/data/track-order'
import { ACCOUNT_LINK } from '@/lib/account-classes'

type RecentOrdersProps = {
  /** The shopper's latest orders, newest first (`listCustomerOrders`). */
  orders: ShopperOrderSummary[]
  timeZone: string
}

/**
 * Track order, signed in: the page title with a link to the full order list, then the shopper's
 * latest orders drawn exactly as on `/account` (`OrderList`), so pre-orders and orders shipping
 * in two parcels read the same in both places. Each card opens `/account/orders/<number>`.
 * Drawn inside `AccountFrame`, whose `.ck` scope the cards' colours come from.
 */
export default function RecentOrders({ orders, timeZone }: RecentOrdersProps) {
  // Render logic
  return (
    <section className="flex flex-col">
      <AccountPageHead
        title={copy.title}
        intro={copy.recent.intro}
        action={
          <Link href="/account" className={ACCOUNT_LINK}>
            {copy.recent.viewAll}
          </Link>
        }
      />
      <OrderList orders={orders} timeZone={timeZone} />
    </section>
  )
}
