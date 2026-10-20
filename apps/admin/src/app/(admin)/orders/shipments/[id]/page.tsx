import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ShipmentOrder from '@/components/shipments/shipment-order'
import { createShipmentContent } from '@/data/create-shipment'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'
export const metadata: Metadata = { title: createShipmentContent.page.title }

type Params = { params: Promise<{ id: string }> }

/** Shipments › an order: Create shipment until it is booked, then the order at its shipment. */
export default async function ShipmentOrderPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const [order, apps] = await Promise.all([
    call(appRouter.orders.get, { id }, { context }).catch(orNoStore(undefined)),
    listApps().catch(() => []),
  ])
  if (order === undefined) redirect(routes.selectStore())
  if (!order) notFound()
  const appCards = apps.filter((a) => a.installed && a.admin.orderDetailCard).map((a) => a.id)
  return <ShipmentOrder order={order} appCards={appCards} />
}
