'use client'

import type { DashboardChartsData } from '@commerce/api'
import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { homeContent } from '@/data/home'
import { api } from '@/lib/api-client'
import SalesOrdersChart from './sales-orders-chart'
import TopProductsChart from './top-products-chart'

type ChartsPanelProps = {
  initialRange: 7 | 30 | 90
  initial: DashboardChartsData
}

type RangeTab = { value: '7' | '30' | '90'; label: string }

/**
 * Owns the one range switch shared by the sales/orders chart and the top-products chart
 * (they both come from `dashboard.charts`, one call per range change), so switching range
 * is the only thing on the home page that refetches.
 */
export default function ChartsPanel({ initialRange, initial }: ChartsPanelProps) {
  // Hooks
  const [range, setRange] = useState<7 | 30 | 90>(initialRange)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (range === initialRange) {
      setData(initial)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    api.dashboard.charts({ range }).then((next) => {
      if (!live) return
      setData(next)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [range, initialRange, initial])

  // Render logic
  const c = homeContent.charts
  const tabs: RangeTab[] = [
    { value: '7', label: c.range7 },
    { value: '30', label: c.range30 },
    { value: '90', label: c.range90 },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-card-title text-ink-strong">{c.sectionTitle}</p>
          <p className="text-caption text-muted-foreground">{c.sectionSubtitle}</p>
        </div>
        <PillTabs
          variant="segmented"
          tabs={tabs}
          value={String(range) as RangeTab['value']}
          onChange={(v) => setRange(Number(v) as 7 | 30 | 90)}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <SalesOrdersChart data={data} loading={loading} />
        <TopProductsChart data={data} loading={loading} />
      </div>
    </div>
  )
}
