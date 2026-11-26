import { nextRewardOf, pointsWorthPaise } from '@commerce/blocks/loyalty'
import { listCustomerOrders, loyaltyState, spendableStoreCredit } from '@commerce/core'
import type { Metadata } from 'next'
import AccountPageHead from '@/components/account/account-page-head'
import LoyaltyStatusSummary from '@/components/account/loyalty-status-summary'
import OrderList from '@/components/account/order-list'
import StoreCreditSummary from '@/components/account/store-credit-summary'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { loyaltyViewFor } from '@/lib/loyalty-view'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type OrdersPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.orders.title }

/**
 * The account's home: the member's points (Loyalty points app, when switched on), store credit to
 * spend (when there is some), then the shopper's orders.
 */
export default async function OrdersPage({ params }: OrdersPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account')
  const { orders, timeZone, creditPaise, loyaltyStatus } = await inStore(storeId, async (tx) => {
    const loyalty = await loyaltyState(tx, storeId)
    return {
      orders: await listCustomerOrders({ storeId, tx }, me.id),
      timeZone: await storeTimeZone(tx, storeId),
      creditPaise: await spendableStoreCredit({ storeId, tx }, me.id),
      // Loyalty points app, Placements → Customer accounts → Loyalty status.
      loyaltyStatus: loyalty.installed && loyalty.settings.pages.accountStatus,
    }
  })
  const view = loyaltyStatus ? await loyaltyViewFor(storeId, await requestOrigin()) : null
  const member = view?.live ? view.member : null
  const next = member && view ? nextRewardOf(view.rewards, member.points) : null
  return (
    <>
      <AccountPageHead title={accountContent.orders.title} />
      {member && view ? (
        <LoyaltyStatusSummary
          points={member.points}
          ready={next?.kind === 'available' ? next.count : 0}
          worthPaise={pointsWorthPaise(member.points, view)}
        />
      ) : null}
      <StoreCreditSummary balancePaise={creditPaise} />
      <OrderList orders={orders} timeZone={timeZone} />
    </>
  )
}
