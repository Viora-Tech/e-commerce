'use client'

import { useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import type { ChartPoint } from '@/components/layout/chart-config'
import StatTabs from '@/components/layout/stat-tabs'
import { customersContent } from '@/data/customers'
import { formatCompact } from '@/lib/money'
import type { CustomerOverview } from './customer-tiles'

type Series = CustomerOverview['thisWeek']
type Metric = keyof Omit<Series, 'days'>

/** Tab order on the frame (5:3076). */
const METRICS: readonly Metric[] = [
  'activeCustomers',
  'repeatCustomers',
  'shopVisitors',
  'conversionRate',
]

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

const percent = (n: number) => `${n.toFixed(1)}%`

function toPoints(series: Series, metric: Metric): ChartPoint[] {
  return series.days.map((date, i) => ({
    label: weekday.format(new Date(`${date}T00:00:00`)),
    value: series[metric][i] ?? 0,
  }))
}

/**
 * Frame 5:3062 "Customer Overview" (826 x 445): four headline tabs pick which
 * daily series the this/last week chart plots, the same interaction as the
 * dashboard's report card.
 */
export default function CustomerOverviewCard({ overview }: { overview: CustomerOverview }) {
  // Hooks
  const [tab, setTab] = useState(0)

  // Render logic
  const c = customersContent.overview
  const metric = METRICS[tab] ?? 'activeCustomers'
  const isRate = metric === 'conversionRate'
  const tabs = [
    { label: c.tabs.activeCustomers, value: formatCompact(overview.activeCustomers) },
    { label: c.tabs.repeatCustomers, value: formatCompact(overview.repeatCustomers) },
    { label: c.tabs.shopVisitors, value: formatCompact(overview.shopVisitors) },
    { label: c.tabs.conversionRate, value: percent(overview.conversionRate) },
  ]

  return (
    <ChartCard
      className="h-[27.8125rem]"
      title={c.title}
      periods={[
        { id: 'this', label: c.thisWeek, data: toPoints(overview.thisWeek, metric) },
        { id: 'last', label: c.lastWeek, data: toPoints(overview.lastWeek, metric) },
      ]}
      tabs={<StatTabs items={tabs} active={tab} onChange={setTab} />}
      seriesKey={metric}
      seriesLabel={c.series[metric]}
      formatValue={isRate ? percent : formatCompact}
    />
  )
}
