import type { AnalyticsKpi } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import CountUp from '@/components/layout/count-up'
import DeltaChip from '@/components/layout/delta-chip'
import MiniBars from '@/components/layout/mini-bars'
import { analyticsContent as copy } from '@/data/analytics'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type KpiTileProps = { kpi: AnalyticsKpi }

/** Money tiles read in rupees, rate tiles as percentages, the rest as plain counts. */
function formatValue(kpi: AnalyticsKpi): string {
  if (kpi.id === 'revenue' || kpi.id === 'aov') return formatPaiseCompact(kpi.value)
  if (kpi.id === 'conversion' || kpi.id === 'returning') return formatRate(kpi.value)
  return formatCompact(kpi.value)
}

/** One KPI: figure, change against the previous period, and the daily shape behind it. */
export default function KpiTile({ kpi }: KpiTileProps) {
  // Render logic
  const meta = copy.kpis[kpi.id]
  const bars = kpi.series.map((value, i) => ({ label: String(i), value }))
  const hasShape = kpi.series.some((v) => v > 0)

  return (
    <Card className="gap-0 p-5">
      <p className="text-kit-body text-muted-foreground">{meta.label}</p>
      <div className="mt-2 flex items-end gap-3">
        <p className="text-kit-stat-sm text-ink-strong tabular-nums">
          <CountUp value={formatValue(kpi)} />
        </p>
        <DeltaChip delta={kpi.delta === null ? null : kpi.delta * 100} size="kit" />
      </div>
      {hasShape ? (
        <MiniBars data={bars} className="mt-4 h-6" />
      ) : (
        <p className="mt-4 h-6 text-kit-mini text-muted-foreground-soft">{meta.help}</p>
      )}
    </Card>
  )
}
