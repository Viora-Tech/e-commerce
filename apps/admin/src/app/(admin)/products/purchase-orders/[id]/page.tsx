import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PurchaseOrderForm from '@/components/purchase-orders/purchase-order-form'
import { purchaseOrdersContent } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: purchaseOrdersContent.heading }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const [po, locations] = await Promise.all([
    call(appRouter.purchaseOrders.get, { id }, { context }),
    call(appRouter.inventory.locations, undefined, { context }),
  ])
  if (!po) notFound()

  // Keyed on updatedAt so a refresh after ordering or receiving remounts the form with fresh state.
  return (
    <PurchaseOrderForm key={new Date(po.updatedAt).toISOString()} po={po} locations={locations} />
  )
}
