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
import SettingsCard from '@/components/settings/settings-card'
import { backInStockContent } from '@/data/back-in-stock'
import { api } from '@/lib/api-client'

type Overview = Awaited<ReturnType<typeof api.backInStock.overview>>

const copy = backInStockContent.overview

function usageRow(label: string, usage: { sent: number; quota: number; unlimited: boolean }) {
  const pct =
    usage.unlimited || usage.quota <= 0 ? 0 : Math.min(100, (usage.sent / usage.quota) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-body">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {usage.unlimited ? copy.unlimited : copy.ofQuota(usage.sent, usage.quota)}
        </span>
      </div>
      {usage.unlimited ? null : <Progress value={pct} />}
      {!usage.unlimited && usage.sent >= usage.quota && usage.quota > 0 ? (
        <p className="text-caption text-destructive">{copy.paused}</p>
      ) : null}
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
      <SettingsCard title={copy.title} bodyClassName="gap-5">
        {usageRow(copy.emailUsage, data.usage.email)}
        {usageRow(copy.whatsappUsage, data.usage.whatsapp)}
      </SettingsCard>
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
            {top.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  {copy.demandEmpty}
                </TableCell>
              </TableRow>
            ) : null}
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
