import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LocationDetail from '@/components/settings/locations/location-detail'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Location' }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const view = await call(appRouter.businessGst.get, undefined, { context })
  const location = view.locations.find((l) => l.id === id)
  if (!location) notFound()
  return <LocationDetail key={location.id} location={location} registrations={view.registrations} />
}
