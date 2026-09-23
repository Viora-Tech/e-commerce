import type { Metadata } from 'next'
import MarketingOverviewPage from '@/components/marketing/marketing-overview'
import { parseRange } from '@/lib/analytics-range'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Marketing' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const range = parseRange(await searchParams)
  const context = await serverContext()
  const overview = await call(appRouter.marketing.overview, { range }, { context })
  return <MarketingOverviewPage initialRange={range} initial={overview} />
}
