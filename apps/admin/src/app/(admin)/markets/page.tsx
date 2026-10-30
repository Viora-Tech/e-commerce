import type { Metadata } from 'next'
import MarketsList from '@/components/markets/markets-list'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Markets' }

export default async function Page() {
  const context = await serverContext()
  const [markets, domains] = await Promise.all([
    call(appRouter.markets.list, undefined, { context }),
    call(appRouter.domains.list, undefined, { context }),
  ])
  return <MarketsList markets={markets} domains={domains} />
}
