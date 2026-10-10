import type { Metadata } from 'next'
import PurchaseOrderForm from '@/components/purchase-orders/purchase-order-form'
import { purchaseOrderFormContent } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: purchaseOrderFormContent.newTitle }

export default async function Page() {
  const context = await serverContext()
  const locations = await call(appRouter.inventory.locations, undefined, { context })

  return <PurchaseOrderForm po={null} locations={locations} costs={null} aiReading={false} />
}
