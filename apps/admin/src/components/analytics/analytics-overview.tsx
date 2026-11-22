'use client'

import type { AnalyticsOverview } from '@commerce/api'
import { Download } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { methodLabel } from '@/components/orders/order-detail-types'
import { analyticsContent } from '@/data/analytics'
import { INDIAN_STATES } from '@/data/india'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { isForbidden } from '@/lib/forbidden'
import { formatPaiseCompact, formatPaiseWhole } from '@/lib/money'
import { routes } from '@/lib/routes'
import BreakdownCard, { type BreakdownRow } from './breakdown-card'
import FunnelCard from './funnel-card'
import KpiStrip from './kpi-strip'
import RangeFailed from './range-failed'
import RangePicker from './range-picker'
import SalesBreakdownCard from './sales-breakdown-card'
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

function toMethodRows(
  overview: AnalyticsOverview,
  detail: typeof orderDetailContent,
): BreakdownRow[] {
  return overview.paymentMethods.map((r) => ({
    key: r.method,
    label: methodLabel(r.method, detail),
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
  const detailCopy = useCopy(orderDetailContent)
  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the read (Try again)
  useEffect(() => {
    setFailed(false)
    if (sameRange(range, initialRange)) {
      setData(initial)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    api.analytics
      .overview({ range })
      .then((next) => {
        if (live) setData(next)
      })
      .catch((err: unknown) => {
        if (live) setFailed(isForbidden(err) ? 'no-access' : 'error')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial, attempt])

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
  /* A preset range ends today, still running: its last point is drawn dashed (audit #147). */
  const live = range.key !== 'custom'
  const totalPaise = data.salesOverTime.day.reduce((sum, p) => sum + p.value, 0)
  const best = data.salesOverTime.day.reduce<(typeof data.salesOverTime.day)[number] | null>(
    (top, p) => (p.value > (top?.value ?? 0) ? p : top),
    null,
  )

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        summary={copy.intro}
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download aria-hidden="true" />
            {copy.salesOverTime.export}
          </Button>
        }
      />
      {/* Figma 658:65755: the range pills sit on their own row under the title. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RangePicker value={range} onChange={handleRange} />
        <span className="text-caption text-muted-foreground">
          {`${formatDay(data.range.from)} – ${formatDay(data.range.to)} · ${copy.compare}`}
        </span>
      </div>
      {/* Figma 306:16434: KPIs in one row, the sales chart full width, then funnel + top
          products side by side; the state and payment breakdowns follow. */}
      {failed ? (
        <RangeFailed
          failed={failed}
          heading={copy.loadFailed}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <>
          <KpiStrip kpis={data.kpis} loading={loading} />
          <ChartCard
            title={copy.salesOverTime.title}
            subtitle={copy.salesOverTime.subtitle(
              formatPaiseWhole(totalPaise),
              copy.salesOverTime.spans[range.key],
              best ? formatDay(best.label) : null,
            )}
            periods={[
              { id: 'day', label: copy.salesOverTime.day, data: dayPoints, partialLast: live },
              { id: 'week', label: copy.salesOverTime.week, data: weekPoints, partialLast: live },
            ]}
            seriesKey={`sales-${range.key}`}
            seriesLabel={copy.salesOverTime.series}
            formatValue={formatPaiseCompact}
            loading={loading}
          />
          {/* The cards under the chart dim while the new range loads (no stale-looking figures). */}
          <div
            aria-busy={loading || undefined}
            className={cn(
              'flex flex-col gap-6 transition-opacity duration-150',
              loading && 'pointer-events-none opacity-50',
            )}
          >
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <FunnelCard steps={data.funnel} />
              <TopProductsCard products={data.topProducts} />
            </div>
            <SalesBreakdownCard copy={copy.salesBreakdown} breakdown={data.salesBreakdown} />
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <BreakdownCard
                title={copy.byState.title}
                rows={toStateRows(data)}
                empty={copy.byState.empty}
              />
              <BreakdownCard
                title={copy.paymentMethods.title}
                rows={toMethodRows(data, detailCopy)}
                empty={copy.paymentMethods.empty}
              />
            </div>
          </div>
        </>
      )}
      <VisitorsSection range={range} />
    </PageBody>
  )
}
