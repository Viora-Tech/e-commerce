import { listCustomerOrders } from '@commerce/core'
import type { Metadata } from 'next'
import OrderList from '@/components/account/order-list'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { ACCOUNT_TITLE } from '@/lib/account-classes'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type OrdersPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.orders.title }

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account')
  const { orders, timeZone } = await inStore(storeId, async (tx) => ({
    orders: await listCustomerOrders({ storeId, tx }, me.id),
    timeZone: await storeTimeZone(tx, storeId),
  }))
  return (
    <>
      <h1 className={`${ACCOUNT_TITLE} mb-5!`}>{accountContent.orders.title}</h1>
      <OrderList orders={orders} timeZone={timeZone} />
    </>
  )
}
