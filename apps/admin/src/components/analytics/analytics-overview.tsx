'use client'

import type { AnalyticsOverview } from '@commerce/api'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import PageHeader from '@/components/layout/page-header'
import { methodLabel } from '@/components/orders/order-detail-types'
import { analyticsContent } from '@/data/analytics'
import { INDIAN_STATES } from '@/data/india'
import { useCopy } from '@/hooks/use-copy'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatPaise, formatPaiseCompact } from '@/lib/money'
import { routes } from '@/lib/routes'
import BreakdownCard, { type BreakdownRow } from './breakdown-card'
import FunnelCard from './funnel-card'
import KpiTile from './kpi-tile'
import RangePicker from './range-picker'
import TopProductsCard from './top-products-card'
import VisitorsSection from './visitors-section'

type AnalyticsOverviewPageProps = {
  initialRange: RangeState
  initial: AnalyticsOverview
}

function stateName(code: string | null): string {
  if (!code) return '-'
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code
}

function toStateRows(overview: AnalyticsOverview): BreakdownRow[] {
  return overview.salesByState.map((r) => ({
    key: r.stateCode ?? 'unknown',
    label: stateName(r.stateCode),
    meta: `${r.orders}`,
    revenuePaise: r.revenuePaise,
    share: r.share,
  }))
}

function toMethodRows(overview: AnalyticsOverview): BreakdownRow[] {
  return overview.paymentMethods.map((r) => ({
    key: r.method,
    label: methodLabel(r.method),
    meta: `${r.orders}`,
    revenuePaise: r.revenuePaise,
    share: r.share,
  }))
}

/** Analytics overview: range picker, KPI tiles, the sales curve and the breakdown cards. */
export default function AnalyticsOverviewPage({
  initialRange,
  initial,
}: AnalyticsOverviewPageProps) {
  // Hooks
  const copy = useCopy(analyticsContent)
  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameRange(range, initialRange)) {
      setData(initial)
      return
    }
    let live = true
    setLoading(true)
    api.analytics
      .overview({ range })
      .then((next) => {
        if (live) setData(next)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial])

  // Event handlers
  const handleRange = (next: RangeState) => {
    setRange(next)
    window.history.replaceState(null, '', `${routes.analytics.home()}${rangeQuery(next)}`)
  }

  const handleExport = () => {
    const rows = data.salesOverTime.day.map((p) => [p.label, p.value / 100])
    downloadCsv(
      copy.salesOverTime.exportFile(data.range.from, data.range.to),
      toCsv([...copy.salesOverTime.exportHeaders], rows),
    )
  }

  // Render logic
  const dayPoints = data.salesOverTime.day.map((p) => ({ ...p, label: formatDay(p.label) }))
  const weekPoints = data.salesOverTime.week.map((p) => ({ ...p, label: formatDay(p.label) }))
  const totalPaise = data.salesOverTime.day.reduce((sum, p) => sum + p.value, 0)
  const best = data.salesOverTime.day.reduce<(typeof data.salesOverTime.day)[number] | null>(
    (top, p) => (p.value > (top?.value ?? 0) ? p : top),
    null,
  )
  // Figma shows five tiles; the order count is already the last step of the funnel below.
  const kpis = data.kpis.filter((kpi) => kpi.id !== 'orders')

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={copy.title}
        summary={copy.intro}
        actions={
          <>
            <RangePicker value={range} onChange={handleRange} />
            <Button variant="key-neutral" onClick={handleExport}>
              {copy.salesOverTime.export}
            </Button>
          </>
        }
      />
      {/* Figma 306:16434: KPIs in one row, the sales chart full width, then funnel + top
          products side by side; the state and payment breakdowns follow. */}
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5"
        aria-busy={loading || undefined}
      >
        {kpis.map((kpi) => (
          <KpiTile key={kpi.id} kpi={kpi} />
        ))}
      </div>
      <ChartCard
        title={copy.salesOverTime.title}
        subtitle={copy.salesOverTime.subtitle(
          formatPaise(totalPaise),
          copy.salesOverTime.spans[range.key],
          best ? formatDay(best.label) : null,
        )}
        periods={[
          { id: 'day', label: copy.salesOverTime.day, data: dayPoints },
          { id: 'week', label: copy.salesOverTime.week, data: weekPoints },
        ]}
        seriesKey={`sales-${range.key}`}
        seriesLabel={copy.salesOverTime.series}
        formatValue={formatPaiseCompact}
      />
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <FunnelCard steps={data.funnel} />
        <TopProductsCard products={data.topProducts} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <BreakdownCard
          title={copy.byState.title}
          rows={toStateRows(data)}
          empty={copy.byState.empty}
        />
        <BreakdownCard
          title={copy.paymentMethods.title}
          rows={toMethodRows(data)}
          empty={copy.paymentMethods.empty}
        />
      </div>
      <VisitorsSection range={range} />
    </div>
  )
}
