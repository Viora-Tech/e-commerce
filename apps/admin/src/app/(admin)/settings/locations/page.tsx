import type { Metadata } from 'next'
import LocationsSettings from '@/components/settings/locations/locations-settings'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Locations' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.businessGst.get, undefined, { context })
  return <LocationsSettings view={view} />
}
