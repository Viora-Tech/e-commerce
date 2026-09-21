'use client'

import { useState } from 'react'
import { ChartCard, type ChartPoint, StatTabs } from '@/components/layout/chart-card'
import { homeContent } from '@/data/home'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type Day = { date: string; revenuePaise: number; orders: number }

type WeeklyReportProps = {
  customers: number
  products: number
  inStock: number
  outOfStock: number
  revenuePaise: number
  thisWeek: Day[]
  lastWeek: Day[]
}

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

function toPoints(days: Day[], metric: 'revenuePaise' | 'orders'): ChartPoint[] {
  return days.map((d) => ({
    label: weekday.format(new Date(`${d.date}T00:00:00`)),
    value: d[metric],
  }))
}

/** "Report for this week": headline tabs + this/last week area chart of revenue (or orders). */
export function WeeklyReport(props: WeeklyReportProps) {
  const [tab, setTab] = useState(4)
  const c = homeContent.report
  // Only revenue has a daily series; every other tab still charts revenue so the card never goes blank.
  const metric = 'revenuePaise'
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
      formatValue={formatPaiseCompact}
    />
  )
}
