'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { type ReactNode, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { CardMenu, type MenuLink } from './data-card'

export type ChartPoint = { label: string; value: number }

type PeriodOption = { id: string; label: string; data: ChartPoint[] }

type ChartCardProps = {
  title: string
  /** Toggle pill in the header; the first option is selected initially. */
  periods: PeriodOption[]
  /** Big-number tabs above the chart. */
  tabs?: ReactNode
  formatValue: (n: number) => string
  /** Links behind the header kebab. */
  menu?: readonly MenuLink[]
  className?: string
}

const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig

/**
 * Frame 5:1558 (739 x 460, 20px padding): 38px header row with the period
 * toggle (178 x 38, two 83 x 30 buttons) and a kebab, the stat tabs 20px
 * below, then the area chart with its axis labels filling the rest.
 */
export function ChartCard({ title, periods, tabs, formatValue, menu, className }: ChartCardProps) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')
  const period = periods.find((p) => p.id === periodId) ?? periods[0]
  const data = period?.data ?? []

  return (
    <Card className={cn('h-[460px] gap-0 p-5', className)}>
      <div className="flex h-[38px] items-center justify-between gap-3">
        <p className="text-card-title text-foreground">{title}</p>
        <div className="flex items-center gap-7">
          {periods.length > 1 ? (
            <div className="flex h-[38px] items-center rounded-full bg-background p-1 text-[14px]">
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodId(p.id)}
                  className={cn(
                    'h-[30px] rounded-full px-3 text-muted-foreground transition-colors',
                    p.id === periodId && 'bg-card font-bold text-primary shadow-toggle',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
          {menu ? <CardMenu items={menu} /> : null}
        </div>
      </div>
      {tabs ? <div className="mt-5 px-1">{tabs}</div> : null}
      <ChartContainer config={chartConfig} className="mt-10 aspect-auto h-[238px] w-full">
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
            tick={{ fontSize: 13, fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 13, fill: 'var(--muted-foreground)' }}
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
            activeDot={{ r: 5, fill: 'var(--chart-1)', strokeWidth: 0 }}
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

/** 5:1595: five 78px cells, 20px apart; 24px figure over a 13px caption, active one tinted with a green rule. */
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
            'flex h-[78px] flex-col items-start gap-2 rounded-t-sm border-b-2 px-2 pt-[15px] text-left transition-colors',
            i === active
              ? 'border-primary bg-background'
              : 'border-border-soft hover:bg-background/60',
          )}
        >
          <span className="text-stat-sm text-foreground tabular-nums">{it.value}</span>
          <span className="text-caption text-muted-foreground-soft">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

type MiniBarsProps = { data: ChartPoint[]; className?: string }

/** 5:1620 "bargraph": 35px strip of 8px green bars, 3px apart, no axes. */
export function MiniBars({ data, className }: MiniBarsProps) {
  return (
    <ChartContainer config={chartConfig} className={cn('aspect-auto h-[35px] w-full', className)}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barCategoryGap={3}>
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={2}
          minPointSize={4}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
