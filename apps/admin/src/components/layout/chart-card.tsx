'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { type ReactNode, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { layoutContent } from '@/data/layout'
import { base, instant } from '@/lib/motion'
import ActionMenu, { type ActionItem } from './action-menu'
import type { ChartPoint } from './chart-config'
import ChartLoading from './chart-loading'

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
  className?: string
}

/* recharts is large: it loads only where a chart is drawn. */
const ChartCardPlot = dynamic(() => import('./chart-card-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/**
 * Sheet 14:366 (739 x 460, 20px padding): 38px header row with the period
 * toggle (Aqua Spring track, white active tab) and a kebab, the stat tabs 20px
 * below, then the area chart: 14px y labels, 12px day labels, green curve with a 4% fill.
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
    <Card className={cn('gap-0 p-5', className)}>
      <div className="flex min-h-[2.375rem] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-kit-title text-foreground">{title}</p>
          {subtitle ? <p className="text-kit-mini text-muted-foreground-soft">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {periods.length > 1 ? (
            <PillTabs
              variant="segmented"
              tabs={periods.map((p) => ({ value: p.id, label: p.label }))}
              value={periodId}
              onChange={setPeriodId}
            />
          ) : null}
          {menu ? <ActionMenu label={layoutContent.moreActions} size="sm" items={menu} /> : null}
        </div>
      </div>
      {tabs ? <div className="mt-5 px-1">{tabs}</div> : null}
      {/* Each metric/period pair mounts its own chart: the curve draws itself once, the previous one fades out. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${seriesKey}-${periodId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="mt-6"
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
    </Card>
  )
}
