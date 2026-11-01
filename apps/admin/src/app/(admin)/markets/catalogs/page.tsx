import type { Metadata } from 'next'
import CatalogsList from '@/components/catalogs/catalogs-list'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Catalogs' }

export default async function Page() {
  const context = await serverContext()
  const catalogs = await call(appRouter.catalogs.list, undefined, { context })
  return <CatalogsList catalogs={catalogs} />
}
