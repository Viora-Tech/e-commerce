'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@commerce/ui/shadcn/chart'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import PillTabs from '@/components/layout/pill-tabs'
import { base, instant } from '@/lib/motion'
import CardMenu, { type MenuLink } from './card-menu'
import { type ChartPoint, chartConfig } from './chart-config'

type PeriodOption = { id: string; label: string; data: ChartPoint[] }

type ChartCardProps = {
  title: string
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
  menu?: readonly MenuLink[]
  className?: string
}

/**
 * Sheet 14:366 (739 x 460, 20px padding): 38px header row with the period
 * toggle (Aqua Spring track, white active tab) and a kebab, the stat tabs 20px
 * below, then the area chart: 14px y labels, 12px day labels, green curve with a 4% fill.
 */
export default function ChartCard({
  title,
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
  const data = period?.data ?? []
  const fade = reduced ? instant : base
  const config = seriesLabel ? { value: { ...chartConfig.value, label: seriesLabel } } : chartConfig

  return (
    <Card className={cn('gap-0 p-5', className)}>
      <div className="flex h-[2.375rem] items-center justify-between gap-3">
        <p className="text-kit-title text-foreground">{title}</p>
        <div className="flex items-center gap-2">
          {periods.length > 1 ? (
            <PillTabs
              variant="segmented"
              tabs={periods.map((p) => ({ value: p.id, label: p.label }))}
              value={periodId}
              onChange={setPeriodId}
            />
          ) : null}
          {menu ? <CardMenu items={menu} /> : null}
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
          <ChartContainer
            config={config}
            className="aspect-auto h-[14.5rem] w-full [&_.recharts-area-area]:animate-in [&_.recharts-area-area]:fade-in [&_.recharts-area-area]:duration-700 [&_.recharts-area-curve]:animate-draw motion-reduce:[&_.recharts-area-area]:animate-none motion-reduce:[&_.recharts-area-curve]:animate-none"
          >
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--border-soft)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                tick={{ fontSize: 14, fill: 'var(--muted-foreground)' }}
                tickFormatter={(v: number) => formatValue(v)}
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(v, name) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{seriesLabel ?? String(name)}</span>
                        <span className="font-bold tabular-nums">{formatValue(Number(v))}</span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#chart-area-fill)"
                isAnimationActive={false}
                activeDot={{ r: 5, fill: 'var(--chart-1)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}
