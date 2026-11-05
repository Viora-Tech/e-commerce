'use client'

import type { DashboardSummary } from '@commerce/api'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import type { DonutSlice as Slice } from './donut-plot'

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

type DonutProps = { title: string; slices: Slice[]; line: string | null; empty: string }

/* recharts is large: it loads only where a chart is drawn. */
const DonutPlot = dynamic(() => import('./donut-plot'), {
  ssr: false,
  loading: () => <ChartLoading className="rounded-full" />,
})

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
    <div className="grid h-full grid-cols-1 gap-6 sm:grid-cols-2">
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
    <DataCard title={title} className="h-full">
      {total === 0 ? (
        <p className="text-body text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="size-32 shrink-0">
            <DonutPlot slices={slices} colors={SLICE_COLORS} total={total} />
          </div>
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
