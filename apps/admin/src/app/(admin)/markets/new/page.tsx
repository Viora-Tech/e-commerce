import type { Metadata } from 'next'
import NewMarketPage from '@/components/markets/new-market-page'
import { serverContext } from '@/lib/api'
import { loadMarketsHome } from '../load'

export const metadata: Metadata = { title: 'New market' }

export default async function Page() {
  const { markets, domains, catalogs, defaults } = await loadMarketsHome(await serverContext())
  return (
    <NewMarketPage markets={markets} domains={domains} catalogs={catalogs} defaults={defaults} />
  )
}
