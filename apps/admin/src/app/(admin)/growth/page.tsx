import type { Metadata } from 'next'
import GrowthOverviewPage from '@/components/growth/growth-overview'
import { parseRange } from '@/lib/analytics-range'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Growth' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const range = parseRange(await searchParams)
  const context = await serverContext()
  const overview = await call(appRouter.marketing.overview, { range }, { context })
  return <GrowthOverviewPage initialRange={range} initial={overview} />
}
