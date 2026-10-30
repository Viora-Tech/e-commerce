import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MarketPage from '@/components/markets/market-page'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function load(id: string) {
  const context = await serverContext()
  const [markets, domains, catalogs] = await Promise.all([
    call(appRouter.markets.list, undefined, { context }),
    call(appRouter.domains.list, undefined, { context }),
    call(appRouter.catalogs.list, undefined, { context }),
  ])
  const market = markets.find((m) => m.id === id) ?? null
  const catalog = catalogs.find((c) => c.id === market?.catalogId) ?? null
  return { markets, domains, market, catalog }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  if (!UUID.test(id)) return { title: 'Markets' }
  const { market } = await load(id)
  return { title: market?.name ?? 'Markets' }
}

/** One market's page; another store's or a malformed id is a 404. */
export default async function Page({ params }: Params) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const { markets, domains, market, catalog } = await load(id)
  if (!market) notFound()
  return <MarketPage market={market} markets={markets} domains={domains} catalog={catalog} />
}
