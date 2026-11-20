'use client'

import type { DashboardSummary, HomeFacts } from '@commerce/api'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { homeContent } from '@/data/home'
import { homeSectionsContent } from '@/data/home-sections'
import { useCopy } from '@/hooks/use-copy'
import LabelledBars from './labelled-bars'

type PaymentStatusBarsProps = {
  /** The last 30 days by real payment method; null when it could not be read. */
  paymentMix: HomeFacts['paymentMix'] | null
  statusMix: DashboardSummary['statusMix']
}

type Row = { key: string; label: string; count: number }

type MixCardProps = { title: string; rows: Row[]; line: string | null; empty: string }

const percent = (n: number, total: number) => `${Math.round((n / total) * 100)}%`

/**
 * How customers pay and Orders by status, side by side as labelled bars (Figma "Home ·
 * Redesign 19 Nov"). Payment methods are real names (UPI, Card, Cash on delivery, Store
 * credit…), never a cut-off "Card, UPI or n…"; status names are capitalised.
 */
export default function PaymentStatusBars({ paymentMix, statusMix }: PaymentStatusBarsProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const sections = useCopy(homeSectionsContent)

  // Render logic
  const c = copy.charts
  const payments: Row[] = (paymentMix ?? []).map((m) => ({
    key: m.method,
    label: sections.paymentMethods[m.method],
    count: m.count,
  }))
  const statuses: Row[] = statusMix.map((s) => ({
    key: s.status,
    label: c.statusLabels[s.status],
    count: s.count,
  }))
  const paymentTotal = payments.reduce((n, r) => n + r.count, 0)
  const statusTotal = statuses.reduce((n, r) => n + r.count, 0)
  const topPayment = payments[0]
  const toShip = statusMix.find((s) => s.status === 'to_ship')?.count ?? 0

  return (
    <>
      <MixCard
        title={c.paymentTitle}
        rows={payments}
        empty={c.paymentEmpty}
        line={
          topPayment && paymentTotal > 0
            ? c.paymentLine(topPayment.label, percent(topPayment.count, paymentTotal))
            : null
        }
      />
      <MixCard
        title={c.statusTitle}
        rows={statuses}
        empty={c.statusEmpty}
        line={
          statusTotal === 0
            ? null
            : toShip > 0
              ? c.statusLine(percent(toShip, statusTotal))
              : c.statusAllShipped
        }
      />
    </>
  )
}

/** One card of bars and its plain-language line; shared by the payment and status cards. */
function MixCard({ title, rows, line, empty }: MixCardProps) {
  const total = rows.reduce((n, r) => n + r.count, 0)
  const bars = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: total > 0 ? percent(r.count, total) : '0%',
    share: total > 0 ? r.count / total : 0,
  }))

  return (
    <DataCard title={title} bodyClassName="flex flex-1 flex-col gap-4">
      {total === 0 ? (
        <EmptyState variant="inline" body={empty} />
      ) : (
        <>
          <LabelledBars bars={bars} label={title} />
          {line ? <p className="mt-auto text-caption text-muted-foreground">{line}</p> : null}
        </>
      )}
    </DataCard>
  )
}
