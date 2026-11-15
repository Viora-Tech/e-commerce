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
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import TableEmptyRow from '@/components/table/table-empty-row'
import { appsContent } from '@/data/apps'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'

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
    <DataCard title={label} bodyClassName="flex flex-col gap-2">
      <span className="text-stat font-semibold text-ink-strong tabular-nums">
        {usage.unlimited ? copy.unlimited : copy.ofQuota(usage.sent, usage.quota)}
      </span>
      {usage.unlimited ? null : <Progress value={pct} />}
      {!usage.unlimited && usage.sent >= usage.quota && usage.quota > 0 ? (
        <p className="text-caption text-destructive">{copy.paused}</p>
      ) : null}
      {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
    </DataCard>
  )
}

/** Usage this month vs quota, and the sold-out variants with the biggest waiting list. */
export default function OverviewPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const { data, failed, retry } = useLoad(() => api.backInStock.overview())

  // Early returns
  if (!data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        {failed ? (
          <LoadFailedState
            size="page"
            heading={apps.couldNotLoad.overview}
            failed={failed}
            onRetry={retry}
          />
        ) : (
          // The two usage cards and the waiting-list table.
          <>
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              <DataCardSkeleton fields={0} lines={2} />
              <DataCardSkeleton fields={0} lines={2} />
            </div>
            <DataCardSkeleton fields={0} lines={4} />
          </>
        )}
      </div>
    )
  }

  // Render logic
  const top = data.topVariants

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <div className="grid gap-4 md:grid-cols-2">
        {usageCard(copy.emailUsage, data.usage.email, null)}
        {usageCard(copy.whatsappUsage, data.usage.whatsapp, copy.whatsappVia)}
      </div>
      <DataCard title={copy.demandTitle} flush>
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
      </DataCard>
    </div>
  )
}
