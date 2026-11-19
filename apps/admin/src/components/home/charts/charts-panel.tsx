'use client'

import type { DashboardChartsData, DashboardSummary, HomeFacts } from '@commerce/api'
import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import SectionHead from '@/components/layout/section-head'
import InlineState from '@/components/states/inline-state'
import { homeContent } from '@/data/home'
import { homeSectionsContent } from '@/data/home-sections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PaymentStatusBars from './payment-status-bars'
import SalesByStateChart from './sales-by-state-chart'
import SalesOrdersChart from './sales-orders-chart'
import TopProductsChart from './top-products-chart'
import WhatChanged from './what-changed'

type ChartsPanelProps = {
  initialRange: 7 | 30 | 90
  initial: DashboardChartsData
  /** Products running low right now, for "What changed". */
  lowStock: number
  streakDays: number
  /** The last 30 days by real payment method; null when it could not be read. */
  paymentMix: HomeFacts['paymentMix'] | null
  statusMix: DashboardSummary['statusMix']
  salesByState: DashboardSummary['salesByState']
}

type RangeTab = { value: '7' | '30' | '90'; label: string }

const DAY_MS = 86_400_000
const SHORT_DATE = { day: 'numeric', month: 'short' } as const

/** A yyyy-mm-dd day moved by `delta` days. */
function shiftDay(iso: string, delta: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10)
}

/**
 * "How you're doing", open (it was the collapsed "More numbers" until 19 Nov): the exact dates
 * compared under the heading, the one 7/30/90 switch, What changed, sales over time beside top
 * products, then how customers pay, orders by status and sales by state as labelled bars. The
 * switch refetches `dashboard.charts` (the only part of Home that does); the three bar cards
 * always read the last 30 days.
 */
export default function ChartsPanel({
  initialRange,
  initial,
  lowStock,
  streakDays,
  paymentMix,
  statusMix,
  salesByState,
}: ChartsPanelProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const doing = useCopy(homeSectionsContent).doing
  const fmt = useFormat()
  const [range, setRange] = useState<7 | 30 | 90>(initialRange)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the read (Try again)
  useEffect(() => {
    setFailed(false)
    if (range === initialRange) {
      setData(initial)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    api.dashboard
      .charts({ range })
      .then((next) => {
        if (!live) return
        setData(next)
        setLoading(false)
      })
      .catch(() => {
        // The charts keep the last range's figures, no longer dimmed, under an error line.
        if (!live) return
        setLoading(false)
        setFailed(true)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial, attempt])

  // Helpers
  // Noon IST, so the day reads the same in any browser time zone.
  const day = (iso: string) => fmt.pattern(new Date(`${iso}T12:00:00+05:30`), SHORT_DATE)

  // Render logic
  const c = copy.charts
  const tabs: RangeTab[] = [
    { value: '7', label: c.range7 },
    { value: '30', label: c.range30 },
    { value: '90', label: c.range90 },
  ]
  const first = data.days[0]
  const last = data.days.at(-1)
  const period =
    first && last
      ? data.previousSalesPaise
        ? doing.period(
            data.range,
            day(first),
            day(last),
            day(shiftDay(first, -data.range)),
            day(shiftDay(first, -1)),
          )
        : doing.periodNoBefore(data.range, day(first), day(last))
      : null

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title={c.sectionTitle}
        intro={period}
        action={
          <PillTabs
            variant="segmented"
            tabs={tabs}
            value={String(range) as RangeTab['value']}
            onChange={(v) => setRange(Number(v) as 7 | 30 | 90)}
          />
        }
      />
      {failed ? <InlineState kind="error" onRetry={() => setAttempt((n) => n + 1)} /> : null}
      <WhatChanged data={data} loading={loading} lowStock={lowStock} streakDays={streakDays} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <SalesOrdersChart data={data} loading={loading} />
        <TopProductsChart data={data} loading={loading} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
        <PaymentStatusBars paymentMix={paymentMix} statusMix={statusMix} />
        <SalesByStateChart salesByState={salesByState} />
      </div>
    </div>
  )
}
