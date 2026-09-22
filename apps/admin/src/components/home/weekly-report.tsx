'use client'

import { useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import type { ChartPoint } from '@/components/layout/chart-config'
import StatTabs from '@/components/layout/stat-tabs'
import { homeContent } from '@/data/home'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type Series = {
  days: string[]
  customers: number[]
  products: number[]
  inStock: number[]
  outOfStock: number[]
  revenuePaise: number[]
}

type WeeklyReportProps = {
  customers: number
  products: number
  inStock: number
  outOfStock: number
  revenuePaise: number
  thisWeek: Series
  lastWeek: Series
}

type Metric = keyof Omit<Series, 'days'>

/** Tab order on the sheet (14:403); Revenue is highlighted in the frame, so it opens selected. */
const METRICS: readonly Metric[] = [
  'customers',
  'products',
  'inStock',
  'outOfStock',
  'revenuePaise',
]
const INITIAL_TAB = METRICS.indexOf('revenuePaise')

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

function toPoints(series: Series, metric: Metric): ChartPoint[] {
  return series.days.map((date, i) => ({
    label: weekday.format(new Date(`${date}T00:00:00`)),
    value: series[metric][i] ?? 0,
  }))
}

/** "Report for this week": five headline tabs pick which daily series the this/last week chart plots. */
export default function WeeklyReport(props: WeeklyReportProps) {
  // Hooks
  const [tab, setTab] = useState(INITIAL_TAB)

  // Render logic
  const c = homeContent.report
  const metric = METRICS[tab] ?? 'revenuePaise'
  const isMoney = metric === 'revenuePaise'
  const tabs = [
    { label: c.tabs.customers, value: formatCompact(props.customers) },
    { label: c.tabs.products, value: formatCompact(props.products) },
    { label: c.tabs.inStock, value: formatCompact(props.inStock) },
    { label: c.tabs.outOfStock, value: formatCompact(props.outOfStock) },
    { label: c.tabs.revenue, value: formatPaiseCompact(props.revenuePaise) },
  ]

  return (
    <ChartCard
      title={c.title}
      periods={[
        { id: 'this', label: c.thisWeek, data: toPoints(props.thisWeek, metric) },
        { id: 'last', label: c.lastWeek, data: toPoints(props.lastWeek, metric) },
      ]}
      tabs={<StatTabs items={tabs} active={tab} onChange={setTab} />}
      seriesKey={metric}
      seriesLabel={c.series[metric]}
      formatValue={isMoney ? formatPaiseCompact : formatCompact}
    />
  )
}
