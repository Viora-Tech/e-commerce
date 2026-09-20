import { notFound, redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { OrderView } from './order-view'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const order = await call(appRouter.orders.get, { id }, { context }).catch(() => undefined)
  if (order === undefined) redirect('/select-store')
  if (!order) notFound()
  return <OrderView order={order} />
}
