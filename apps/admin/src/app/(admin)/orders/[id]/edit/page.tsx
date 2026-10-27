import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import OrderEditPage from '@/components/orders/edit/order-edit-page'
import { orderEditContent } from '@/data/order-edit'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: orderEditContent.action }

type Params = { params: Promise<{ id: string }> }

/** Orders › #1042 › Edit order: add, remove, quantities, shipping and discount, then review. */
export default async function EditOrderPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const order = await call(appRouter.orders.get, { id }, { context }).catch(orNoStore(undefined))
  if (order === undefined) redirect(routes.selectStore())
  if (!order) notFound()
  return <OrderEditPage order={order} />
}
