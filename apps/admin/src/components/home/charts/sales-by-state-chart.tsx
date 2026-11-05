'use client'

import type { DashboardSummary } from '@commerce/api'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { stateName } from '@/data/india'
import { useCopy } from '@/hooks/use-copy'

type SalesByStateChartProps = {
  salesByState: DashboardSummary['salesByState']
}

/* recharts is large: it loads only where a chart is drawn. */
const SalesByStatePlot = dynamic(() => import('./sales-by-state-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/** Top states by revenue over the last 30 days, reusing the same rows as the order map. */
export default function SalesByStateChart({ salesByState }: SalesByStateChartProps) {
  // Hooks
  const copy = useCopy(homeContent)

  // Render logic
  const c = copy.charts
  const points = salesByState.map((s) => ({
    code: s.stateCode,
    label: stateName(s.stateCode),
    revenuePaise: s.revenuePaise,
    share: s.share,
  }))
  const top = points[0]

  return (
    <DataCard title={c.stateTitle}>
      {points.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.stateEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="h-48 w-full">
            <SalesByStatePlot points={points} />
          </div>
          {top ? (
            <p className="text-caption text-muted-foreground">
              {c.stateLine(top.label, `${Math.round(top.share * 100)}%`)}
            </p>
          ) : null}
        </div>
      )}
    </DataCard>
  )
}
