'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { MoreVertical } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

export type ChartPoint = { label: string; value: number }

type PeriodOption = { id: string; label: string; data: ChartPoint[] }

type ChartCardProps = {
  title: string
  /** Toggle pill in the header; the first option is selected initially. */
  periods: PeriodOption[]
  /** Big-number tabs above the chart. */
  tabs?: ReactNode
  formatValue: (n: number) => string
  className?: string
}

const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** Kit "Report for this week": header with period toggle, stat tabs, gradient area chart. */
export function ChartCard({ title, periods, tabs, formatValue, className }: ChartCardProps) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')
  const period = periods.find((p) => p.id === periodId) ?? periods[0]
  const data = period?.data ?? []

  return (
    <Card className={cn('gap-0 px-5 py-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-card-title">{title}</p>
        <div className="flex items-center gap-4">
          {periods.length > 1 ? (
            <div className="flex h-9 items-center rounded-full bg-muted p-1 text-[12px]">
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodId(p.id)}
                  className={cn(
                    'h-7 rounded-full px-3 text-muted-foreground transition-colors',
                    p.id === periodId && 'bg-card font-bold text-primary shadow-toggle',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
          <MoreVertical className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      {tabs ? <div className="mt-4">{tabs}</div> : null}
      <ChartContainer config={chartConfig} className="mt-6 aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--border-soft)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => formatValue(v)}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(v) => <span className="font-bold">{formatValue(Number(v))}</span>}
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
            activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  )
}

type StatTabsProps = {
  items: { label: string; value: string }[]
  active?: number
  onChange?: (index: number) => void
}

/** Big number + caption cells with an underline on the active one. */
export function StatTabs({ items, active = 0, onChange }: StatTabsProps) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <button
          key={it.label}
          type="button"
          onClick={onChange ? () => onChange(i) : undefined}
          className={cn(
            'flex flex-col items-start gap-2 border-b px-2 py-3 text-left',
            i === active
              ? 'border-b-2 border-primary bg-gradient-to-b from-transparent to-primary/5'
              : 'border-border-soft',
          )}
        >
          <span className="text-stat-sm tabular-nums">{it.value}</span>
          <span className="text-caption text-muted-foreground-soft">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

type MiniBarsProps = { data: ChartPoint[]; className?: string }

/** Thin bar strip ("Users per minute") — no axes, primary fill. */
export function MiniBars({ data, className }: MiniBarsProps) {
  return (
    <ChartContainer config={chartConfig} className={cn('aspect-auto h-10 w-full', className)}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barCategoryGap={2}>
        <Bar dataKey="value" fill="var(--chart-1)" radius={1} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}
