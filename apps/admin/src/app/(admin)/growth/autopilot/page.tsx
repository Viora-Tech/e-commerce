import type { MarketingOverview } from '@commerce/api'
import type { Metadata } from 'next'
import AutopilotPage from '@/components/growth/autopilot/autopilot-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Autopilot' }

function kpiOf(overview: MarketingOverview, id: string) {
  return overview.kpis.find((k) => k.id === id)
}

export default async function Page() {
  // Render logic
  const context = await serverContext()
  const [view, overview] = await Promise.all([
    call(appRouter.marketing.autopilot.get, undefined, { context }),
    call(appRouter.marketing.overview, { range: { key: '30d' } }, { context }),
  ])

  return (
    <AutopilotPage
      initial={view}
      results={{
        attributed: kpiOf(overview, 'attributed_sales'),
        total: kpiOf(overview, 'total_sales'),
        days: overview.range.days,
      }}
    />
  )
}
