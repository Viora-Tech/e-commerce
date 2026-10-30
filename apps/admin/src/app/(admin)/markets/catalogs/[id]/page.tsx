import { notFound, redirect } from 'next/navigation'
import CatalogForm from '@/components/catalogs/catalog-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'
import { loadCatalogPage } from '../load'

type Params = { params: Promise<{ id: string }> }

/** A missing catalog (another store's, or a malformed id) is a 404, not an error page. */
const missing = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') return null
  return orNoStore(undefined)(error)
}

export default async function CatalogPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const catalog = await call(appRouter.catalogs.get, { id }, { context }).catch(missing)
  if (catalog === undefined) redirect(routes.selectStore())
  if (!catalog) notFound()
  const { markets, catalogs } = await loadCatalogPage(context)
  return (
    <CatalogForm
      key={`${catalog.id}-${catalog.markets.length}-${catalog.prices.length}`}
      catalog={catalog}
      markets={markets}
      catalogs={catalogs}
    />
  )
}
