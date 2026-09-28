'use client'

import type { DashboardSummary } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Cell, Pie, PieChart } from 'recharts'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'

type PaymentStatusDonutsProps = {
  paymentMix: DashboardSummary['paymentMix']
  statusMix: DashboardSummary['statusMix']
}

const SLICE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

const config = {} satisfies ChartConfig

type Slice = { key: string; label: string; count: number }

type DonutProps = { title: string; slices: Slice[]; line: string | null; empty: string }

/** Two small donuts side by side: how customers pay, and where orders sit right now. */
export default function PaymentStatusDonuts({ paymentMix, statusMix }: PaymentStatusDonutsProps) {
  // Hooks
  const copy = useCopy(homeContent)

  // Render logic
  const c = copy.charts
  const paymentSlices: Slice[] = paymentMix.map((m) => ({
    key: m.label,
    label: m.label,
    count: m.count,
  }))
  const statusSlices: Slice[] = statusMix
    .filter((s) => s.count > 0)
    .map((s) => ({ key: s.status, label: c.statusLabels[s.status], count: s.count }))
  const topPayment = paymentSlices[0]
  const paymentTotal = paymentSlices.reduce((n, s) => n + s.count, 0)
  const statusTotal = statusSlices.reduce((n, s) => n + s.count, 0)
  const topStatus = statusSlices[0]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Donut
        title={c.paymentTitle}
        slices={paymentSlices}
        empty={c.paymentEmpty}
        line={
          topPayment && paymentTotal > 0
            ? c.paymentLine(
                topPayment.label,
                `${Math.round((topPayment.count / paymentTotal) * 100)}%`,
              )
            : null
        }
      />
      <Donut
        title={c.statusTitle}
        slices={statusSlices}
        empty={c.statusEmpty}
        line={
          topStatus && statusTotal > 0
            ? c.statusLine(topStatus.label, `${Math.round((topStatus.count / statusTotal) * 100)}%`)
            : null
        }
      />
    </div>
  )
}

/** One donut, its legend and its plain-language line; shared by the payment and status cards. */
function Donut({ title, slices, line, empty }: DonutProps) {
  const total = slices.reduce((n, s) => n + s.count, 0)

  return (
    <DataCard title={title}>
      {total === 0 ? (
        <p className="text-body text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex items-center gap-4">
          <ChartContainer config={config} className="aspect-square h-32 w-32 shrink-0">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(v, _name, item) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {(item.payload as Slice).label}
                        </span>
                        <span className="font-bold tabular-nums">
                          {Math.round((Number(v) / total) * 100)}%
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                innerRadius={32}
                outerRadius={56}
                strokeWidth={2}
              >
                {slices.map((s, i) => (
                  <Cell key={s.key} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <ul className="flex flex-col gap-1.5">
              {slices.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2 text-caption">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate text-muted-foreground">{s.label}</span>
                  <span className="ml-auto shrink-0 font-medium text-ink-strong tabular-nums">
                    {Math.round((s.count / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            {line ? <p className="text-caption text-muted-foreground">{line}</p> : null}
          </div>
        </div>
      )}
    </DataCard>
  )
}
