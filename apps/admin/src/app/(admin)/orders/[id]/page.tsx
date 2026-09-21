import { notFound, redirect } from 'next/navigation'
import { OrderView } from '@/components/orders/order-view'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export default async function OrderPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const order = await call(appRouter.orders.get, { id }, { context }).catch(() => undefined)
  if (order === undefined) redirect('/select-store')
  if (!order) notFound()
  return <OrderView order={order} />
}
