import type { Metadata } from 'next'
import AnalyticsOverviewPage from '@/components/analytics/analytics-overview'
import { parseRange } from '@/lib/analytics-range'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Analytics' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const range = parseRange(await searchParams)
  const context = await serverContext()
  const overview = await call(appRouter.analytics.overview, { range }, { context })
  return <AnalyticsOverviewPage initialRange={range} initial={overview} />
}
