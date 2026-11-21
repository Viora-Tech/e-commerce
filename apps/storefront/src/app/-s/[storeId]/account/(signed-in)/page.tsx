import { listCustomerOrders, spendableStoreCredit } from '@commerce/core'
import type { Metadata } from 'next'
import AccountPageHead from '@/components/account/account-page-head'
import OrderList from '@/components/account/order-list'
import StoreCreditSummary from '@/components/account/store-credit-summary'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type OrdersPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.orders.title }

/** The account's home: store credit to spend (when there is some), then the shopper's orders. */
export default async function OrdersPage({ params }: OrdersPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account')
  const { orders, timeZone, creditPaise } = await inStore(storeId, async (tx) => ({
    orders: await listCustomerOrders({ storeId, tx }, me.id),
    timeZone: await storeTimeZone(tx, storeId),
    creditPaise: await spendableStoreCredit({ storeId, tx }, me.id),
  }))
  return (
    <>
      <AccountPageHead title={accountContent.orders.title} />
      <StoreCreditSummary balancePaise={creditPaise} />
      <OrderList orders={orders} timeZone={timeZone} />
    </>
  )
}
