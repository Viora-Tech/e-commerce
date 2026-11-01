import type { Metadata } from 'next'
import MarketsList from '@/components/markets/markets-list'
import { serverContext } from '@/lib/api'
import { loadMarketsHome } from './load'

export const metadata: Metadata = { title: 'Markets' }

export default async function Page() {
  const { markets, domains, catalogs, defaults, suggestMarket } = await loadMarketsHome(
    await serverContext(),
  )
  return (
    <MarketsList
      markets={markets}
      domains={domains}
      catalogs={catalogs}
      defaults={defaults}
      suggestMarket={suggestMarket}
    />
  )
}
