import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ShipmentOrder from '@/components/shipments/shipment-order'
import { createShipmentContent } from '@/data/create-shipment'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStoreOrMissing } from '@/lib/store-guard'
export const metadata: Metadata = { title: createShipmentContent.page.title }

type Params = {
  params: Promise<{ id: string }>
  /** `parcel`: the parcel a To book row opened (a Part 2 still to book). */
  searchParams: Promise<{ parcel?: string | string[] }>
}

/** Shipments › an order: Create shipment until it is booked, then the order at its shipment. */
export default async function ShipmentOrderPage({ params, searchParams }: Params) {
  const { id } = await params
  const { parcel } = await searchParams
  const context = await serverContext()
  const [order, apps] = await Promise.all([
    call(appRouter.orders.get, { id }, { context }).catch(orNoStoreOrMissing(undefined)),
    listApps().catch(() => []),
  ])
  if (order === undefined) redirect(routes.selectStore())
  if (!order) notFound()
  const appCards = apps.filter((a) => a.installed && a.admin.orderDetailCard).map((a) => a.id)
  return (
    <ShipmentOrder
      order={order}
      appCards={appCards}
      parcel={typeof parcel === 'string' ? parcel : undefined}
    />
  )
}
