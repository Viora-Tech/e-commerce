'use client'

import type { DashboardSummary } from '@commerce/api'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { homeContent } from '@/data/home'
import { stateName } from '@/data/india'
import { useCopy, useFormat } from '@/hooks/use-copy'
import LabelledBars from './labelled-bars'

type SalesByStateChartProps = {
  salesByState: DashboardSummary['salesByState']
}

/** Top states by revenue over the last 30 days, as labelled bars (the order map's rows). */
export default function SalesByStateChart({ salesByState }: SalesByStateChartProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()

  // Render logic
  const c = copy.charts
  const most = salesByState[0]?.revenuePaise ?? 0
  const bars = salesByState.map((s) => ({
    key: s.stateCode,
    label: stateName(s.stateCode),
    value: fmt.moneyWhole(s.revenuePaise),
    share: most > 0 ? s.revenuePaise / most : 0,
  }))
  const top = salesByState[0]

  return (
    <DataCard title={c.stateTitle} bodyClassName="flex flex-1 flex-col gap-4">
      {bars.length === 0 ? (
        <EmptyState variant="inline" body={c.stateEmpty} />
      ) : (
        <>
          <LabelledBars bars={bars} label={c.stateTitle} />
          {top ? (
            <p className="mt-auto text-caption text-muted-foreground">
              {c.stateLine(stateName(top.stateCode), `${Math.round(top.share * 100)}%`)}
            </p>
          ) : null}
        </>
      )}
    </DataCard>
  )
}
