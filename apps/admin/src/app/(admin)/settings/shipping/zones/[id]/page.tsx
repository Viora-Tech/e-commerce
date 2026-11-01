import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ZoneForm from '@/components/shipping-zones/zone-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const found = await call(appRouter.shipping.zones.get, { id }, { context }).catch(() => null)
  return { title: found?.name || 'Shipping zone' }
}

export default async function ShippingZonePage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const zone = await call(appRouter.shipping.zones.get, { id }, { context }).catch(
    orNoStoreOrMissing(undefined),
  )
  if (zone === undefined) redirect('/select-store')
  if (!zone) notFound()
  return <ZoneForm key={zone.updatedAt.toISOString()} zone={zone} />
}
