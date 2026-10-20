import { notFound, redirect } from 'next/navigation'
import OrderView from '@/components/orders/order-view'
import { appRouter, call, serverContext } from '@/lib/api'
import { listApps } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export default async function OrderPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const [order, apps, appActions] = await Promise.all([
    call(appRouter.orders.get, { id }, { context }).catch(orNoStore(undefined)),
    listApps().catch(() => []),
    call(appRouter.apps.orderActions, undefined, { context }).catch(() => []),
  ])
  if (order === undefined) redirect('/select-store')
  if (!order) notFound()
  const appCards = apps.filter((a) => a.installed && a.admin.orderDetailCard).map((a) => a.id)
  return <OrderView order={order} appCards={appCards} appActions={appActions} />
}
