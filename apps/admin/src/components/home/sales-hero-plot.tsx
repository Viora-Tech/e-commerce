'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { motion, useReducedMotion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import { base, EASE_OUT, instant, MOTION_MS } from '@/lib/motion'
import type { SalesChartPoint } from './sales-hero-chart'

type SalesHeroPlotProps = {
  points: SalesChartPoint[]
  valueLabel: string
  beforeLabel: string
  /** Changes with the hero's range/metric: the lines crossfade with a 2px blur, never a jump. */
  swapKey: string
  formatTooltip: (value: number) => string
  formatTick: (value: number) => string
}

/** The hero's area chart itself; `SalesHeroChart` holds its height while recharts loads. */
export default function SalesHeroPlot({
  points,
  valueLabel,
  beforeLabel,
  swapKey,
  formatTooltip,
  formatTick,
}: SalesHeroPlotProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const config = {
    value: { label: valueLabel, color: 'var(--primary)' },
    before: { label: beforeLabel, color: 'var(--muted-foreground)' },
  } satisfies ChartConfig
  const swap = reduced ? instant : base

  return (
    <motion.div
      className="size-full"
      initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
      whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
      viewport={{ once: true }}
      transition={{ duration: MOTION_MS.draw / 1000, ease: EASE_OUT }}
    >
      <motion.div
        key={swapKey}
        className="size-full"
        initial={reduced ? false : { opacity: 0, filter: 'blur(2px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={swap}
      >
        <ChartContainer config={config} className="aspect-auto size-full">
          <AreaChart data={points} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="home-hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              minTickGap={48}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={formatTick}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }}
              content={
                <ChartTooltipContent
                  formatter={(v, name) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label}
                      </span>
                      <span className="font-bold tabular-nums">{formatTooltip(Number(v))}</span>
                    </span>
                  )}
                />
              }
            />
            <Line
              dataKey="before"
              type="monotone"
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#home-hero-fill)"
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
      </motion.div>
    </motion.div>
  )
}
