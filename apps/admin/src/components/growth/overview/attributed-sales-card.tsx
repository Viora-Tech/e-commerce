'use client'

import type { MarketingKpi } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import DeltaChip from '@/components/layout/delta-chip'
import PillTabs from '@/components/layout/pill-tabs'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay } from '@/lib/analytics-range'
import GrowthTrendChart, { type TrendPoint } from '../growth-trend-chart'
import MetricLabel from '../metric-label'

type AttributedSalesCardProps = {
  attributed: MarketingKpi | undefined
  total: MarketingKpi | undefined
  days: string[]
  /** Attribution's full-width version: a taller chart with a daily / weekly switch. */
  detailed?: boolean
}

type Grain = 'day' | 'week'

/** Day-by-day values folded into 7-day buckets, labelled by each week's first day. */
function byWeek(days: string[], current: number[], before: number[]): TrendPoint[] {
  const out: TrendPoint[] = []
  for (let i = 0; i < days.length; i += 7) {
    let value = 0
    let previous = 0
    for (let j = i; j < Math.min(i + 7, days.length); j++) {
      value += current[j] ?? 0
      previous += before[j] ?? 0
    }
    out.push({ label: formatDay(days[i] ?? ''), value, before: previous })
  }
  return out
}

/** "Sales attributed to marketing": the amount, of total store sales, its change and the line against the period before. */
export default function AttributedSalesCard({
  attributed,
  total,
  days,
  detailed = false,
}: AttributedSalesCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.attributed)
  const fmt = useFormat()
  const [grain, setGrain] = useState<Grain>('day')

  // Render logic
  const current = attributed?.series ?? []
  const before = attributed?.previousSeries ?? []
  const points: TrendPoint[] =
    detailed && grain === 'week'
      ? byWeek(days, current, before)
      : days.map((day, i) => ({
          label: formatDay(day),
          value: current[i] ?? 0,
          before: before[i] ?? 0,
        }))
  const delta = attributed?.delta ?? null

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <MetricLabel help={copy.help} className="text-body-strong text-foreground">
          {copy.label}
        </MetricLabel>
        <div className="flex items-center gap-2">
          {detailed ? (
            <PillTabs
              variant="segmented"
              tabs={[
                { value: 'day', label: copy.daily },
                { value: 'week', label: copy.weekly },
              ]}
              value={grain}
              onChange={setGrain}
            />
          ) : null}
          <DeltaChip delta={delta === null ? null : delta * 100} size="kit" />
        </div>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-stat tabular-nums text-foreground">
          {fmt.money(attributed?.value ?? 0)}
        </span>
        <span className="text-caption text-muted-foreground">
          {copy.ofTotal(fmt.money(total?.value ?? 0))}
        </span>
      </p>
      <GrowthTrendChart
        points={points}
        series={[
          { key: 'before', label: copy.previous, color: 'var(--muted-foreground)', dashed: true },
          { key: 'value', label: copy.current, color: 'var(--chart-1)' },
        ]}
        formatValue={fmt.moneyCompact}
        emptyNote={copy.empty}
        className={detailed ? 'h-64' : 'h-44'}
      />
    </Card>
  )
}
