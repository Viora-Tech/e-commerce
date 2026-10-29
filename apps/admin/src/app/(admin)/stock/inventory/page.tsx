import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import InventoryPage from './inventory-page'

export const metadata: Metadata = { title: 'Inventory' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const query = parseListQuery(sp, [] as const)
  const context = await serverContext()
  const locations = await call(appRouter.inventory.locations, undefined, { context })
  const asked = typeof sp.location === 'string' ? sp.location : null
  const location =
    locations.find((l) => l.id === asked) ??
    locations.find((l) => l.fulfilsOnlineOrders) ??
    locations[0]
  const locationId = location?.id as string
  const group = sp.group === 'variant' ? 'variant' : 'product'
  const [result, stats, facets] = await Promise.all([
    call(
      appRouter.inventory.list,
      {
        locationId,
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
        group,
      },
      { context },
    ),
    call(appRouter.inventory.stats, { locationId }, { context }),
    call(appRouter.inventory.facets, undefined, { context }),
  ])

  return <InventoryPage initial={{ query, locationId, group, locations, result, stats, facets }} />
}
