'use client'

import type { DashboardChartsData } from '@commerce/api'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import ChartLoading from '@/components/layout/chart-loading'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { homeContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

type SalesOrdersChartProps = {
  data: DashboardChartsData
  loading: boolean
}

type Metric = 'sales' | 'orders'

/* recharts is large: it loads only where a chart is drawn. */
const SalesOrdersPlot = dynamic(() => import('./sales-orders-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

const SHORT_DATE_OPTIONS = { day: 'numeric', month: 'short' } as const
const SHORT_DATE: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(INTL_LOCALE.en, SHORT_DATE_OPTIONS),
  hi: new Intl.DateTimeFormat(INTL_LOCALE.hi, SHORT_DATE_OPTIONS),
}

function shortDay(iso: string, locale: Locale): string {
  return SHORT_DATE[locale].format(new Date(`${iso}T00:00:00+05:30`))
}

/** Total, and its percent change against the previous period; null when there is nothing to compare. */
function changeLine(
  totals: { current: number; previous: number | null },
  c: (typeof homeContent)['charts'],
): string | null {
  if (totals.previous === null) return c.salesNoPrevious
  if (totals.previous === 0) return null
  const pct = ((totals.current - totals.previous) / totals.previous) * 100
  if (Math.abs(pct) < 1) return c.salesFlat
  const formatted = `${Math.abs(pct).toFixed(0)}%`
  return c.salesLine(formatted, pct > 0)
}

/**
 * Sales (area, previous period dashed behind it) or orders (bars) for the picked range, with
 * a plain-language line under it. The range switch itself lives in the parent `ChartsPanel`.
 */
export default function SalesOrdersChart({ data, loading }: SalesOrdersChartProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()
  const [metric, setMetric] = useState<Metric>('sales')

  // Render logic
  const c = copy.charts
  const points = data.days.map((day, i) => ({
    label: shortDay(day, fmt.locale),
    sales: data.salesPaise[i] ?? 0,
    previousSales: data.previousSalesPaise?.[i] ?? null,
    orders: data.orders[i] ?? 0,
  }))
  const totalSales = data.salesPaise.reduce((n, v) => n + v, 0)
  const previousTotalSales = data.previousSalesPaise
    ? data.previousSalesPaise.reduce((n, v) => n + v, 0)
    : null
  const line = changeLine({ current: totalSales, previous: previousTotalSales }, c)
  const hasData = totalSales > 0 || data.orders.some((n) => n > 0)

  return (
    <DataCard
      title={c.salesTitle}
      action={
        <PillTabs
          variant="segmented"
          tabs={[
            { value: 'sales' as Metric, label: c.salesToggle },
            { value: 'orders' as Metric, label: c.ordersToggle },
          ]}
          value={metric}
          onChange={setMetric}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !hasData ? (
        <p className="text-body text-muted-foreground">{c.salesEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="h-64 w-full">
            <SalesOrdersPlot
              points={points}
              metric={metric}
              hasPrevious={Boolean(data.previousSalesPaise)}
            />
          </div>
          {line ? <p className="text-caption text-muted-foreground">{line}</p> : null}
        </div>
      )}
    </DataCard>
  )
}
