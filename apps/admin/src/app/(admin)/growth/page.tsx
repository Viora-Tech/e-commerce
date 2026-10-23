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
  const [overview, recommendations, campaigns, autopilot] = await Promise.all([
    call(appRouter.marketing.overview, { range }, { context }),
    call(appRouter.marketing.recommendations, undefined, { context }),
    call(appRouter.marketing.campaignPerformance, undefined, { context }),
    call(appRouter.marketing.autopilot.get, undefined, { context }),
  ])
  return (
    <GrowthOverviewPage
      initialRange={range}
      initial={overview}
      recommendations={recommendations}
      campaigns={campaigns}
      autopilot={{
        enabled: autopilot.settings.enabled,
        waiting: autopilot.proposals.filter((p) => p.status === 'proposed').length,
      }}
    />
  )
}
