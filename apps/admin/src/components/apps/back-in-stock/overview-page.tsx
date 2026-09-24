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
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
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
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <DataCard title={copy.title}>
        <div className="flex flex-col gap-5 p-4">
          {usageRow(copy.emailUsage, data.usage.email)}
          {usageRow(copy.whatsappUsage, data.usage.whatsapp)}
        </div>
      </DataCard>
      <DataCard title={copy.demandTitle} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.variant}</TableHead>
              <TableHead className="text-right">{copy.columns.waiting}</TableHead>
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
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell className="text-right tabular-nums">{t.waiting}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  )
}
