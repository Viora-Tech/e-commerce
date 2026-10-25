'use client'

import { Progress } from '@commerce/ui/shadcn/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import PageHeader from '@/components/layout/page-header'
import TableEmptyRow from '@/components/table/table-empty-row'
import { backInStockContent } from '@/data/back-in-stock'
import { api } from '@/lib/api-client'

type Overview = Awaited<ReturnType<typeof api.backInStock.overview>>

const copy = backInStockContent.overview

/** Figma "Back in stock · Overview": one card per channel, the count large, a bar while there is a quota. */
function usageCard(
  label: string,
  usage: { sent: number; quota: number; unlimited: boolean },
  note: string | null,
) {
  const pct =
    usage.unlimited || usage.quota <= 0 ? 0 : Math.min(100, (usage.sent / usage.quota) * 100)
  return (
    <div className="flex flex-col gap-2 rounded-xl surface-card px-5 py-4">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold text-ink-strong tabular-nums">
        {usage.unlimited ? copy.unlimited : copy.ofQuota(usage.sent, usage.quota)}
      </span>
      {usage.unlimited ? null : <Progress value={pct} />}
      {!usage.unlimited && usage.sent >= usage.quota && usage.quota > 0 ? (
        <p className="text-caption text-destructive">{copy.paused}</p>
      ) : null}
      {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/** Usage this month vs quota, and the sold-out variants with the biggest waiting list. */
export default function OverviewPage() {
  // Hooks
  const [data, setData] = useState<Overview | null>(null)

  useEffect(() => {
    let cancelled = false
    api.backInStock.overview().then((r) => {
      if (!cancelled) setData(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Early returns
  if (!data) return null

  // Render logic
  const top = data.topVariants

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <div className="grid gap-4 md:grid-cols-2">
        {usageCard(copy.emailUsage, data.usage.email, null)}
        {usageCard(copy.whatsappUsage, data.usage.whatsapp, copy.whatsappVia)}
      </div>
      <div className="overflow-hidden rounded-xl surface-card">
        <h2 className="px-6 pt-5 pb-3 text-body font-semibold text-ink-strong">
          {copy.demandTitle}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.columns.variant}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.waiting}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.length === 0 ? <TableEmptyRow colSpan={2} message={copy.demandEmpty} /> : null}
            {top.map((t) => (
              <TableRow key={t.variantId}>
                <TableCell className={`${CELL} font-medium`}>{t.label}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>{t.waiting}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
