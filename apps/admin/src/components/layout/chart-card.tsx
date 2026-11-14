'use client'

import { cn } from '@commerce/ui/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { type ReactNode, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { base, instant } from '@/lib/motion'
import type { ActionItem } from './action-menu'
import type { ChartPoint } from './chart-config'
import ChartLoading from './chart-loading'
import DataCard from './data-card'

type PeriodOption = {
  id: string
  label: string
  data: ChartPoint[]
  /** The last point is a period still running (today): drawn as a dashed line (audit #147). */
  partialLast?: boolean | undefined
}

type ChartCardProps = {
  title: string
  /** A plain line under the title ("₹4,61,320 in the last 30 days, best day 5 Oct"). */
  subtitle?: string
  /** Toggle pill in the header; the first option is selected initially. */
  periods: PeriodOption[]
  /** Big-number tabs above the chart. */
  tabs?: ReactNode
  /** Identifies the plotted series (metric); changing it crossfades the chart. */
  seriesKey?: string
  /** Name shown in the tooltip for the plotted series. */
  seriesLabel?: string
  formatValue: (n: number) => string
  /** Links behind the header kebab. */
  menu?: readonly ActionItem[]
  /**
   * New figures are on the way (a range change): the chart frame draws a skeleton and the
   * subtitle and tabs dim, so the old curve and totals are not read as the new ones.
   */
  loading?: boolean
  className?: string
}

/* recharts is large: it loads only where a chart is drawn. */
const ChartCardPlot = dynamic(() => import('./chart-card-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/**
 * A DataCard with a chart body (Sheet 14:366): the card title, the period toggle and a kebab in
 * the header, the stat tabs under it, then the area chart (green curve with a 4% fill).
 */
export default function ChartCard({
  title,
  subtitle,
  periods,
  tabs,
  seriesKey = 'value',
  seriesLabel,
  formatValue,
  menu,
  loading = false,
  className,
}: ChartCardProps) {
  // Hooks
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')
  const reduced = useReducedMotion()

  // Render logic
  const period = periods.find((p) => p.id === periodId) ?? periods[0]
  const partial = period?.partialLast === true
  const fade = reduced ? instant : base

  return (
    <DataCard
      title={title}
      subtitle={subtitle && loading ? <span className="opacity-50">{subtitle}</span> : subtitle}
      menu={menu}
      className={className}
      action={
        periods.length > 1 ? (
          <PillTabs
            variant="segmented"
            tabs={periods.map((p) => ({ value: p.id, label: p.label }))}
            value={periodId}
            onChange={setPeriodId}
          />
        ) : null
      }
    >
      {tabs ? (
        <div className={cn('mb-6 px-1', loading && 'pointer-events-none opacity-50')}>{tabs}</div>
      ) : null}
      {/* Each metric/period pair mounts its own chart: the curve draws itself once, the previous one fades out. */}
      {loading ? (
        <div className="h-[14.5rem] w-full" aria-busy="true">
          <ChartLoading />
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${seriesKey}-${periodId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            <div className="h-[14.5rem] w-full">
              <ChartCardPlot
                data={period?.data ?? []}
                partial={partial}
                seriesLabel={seriesLabel}
                formatValue={formatValue}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </DataCard>
  )
}
