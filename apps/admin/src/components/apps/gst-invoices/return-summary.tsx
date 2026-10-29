'use client'

import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import Gstr1Card from './gstr1-card'
import Gstr3bCard from './gstr3b-card'
import { monthRange } from './return-months'
import ReturnWarnings from './return-warnings'
import { saveFile } from './save-file'

type Summary = Awaited<ReturnType<typeof api.gstInvoices.returns.summary>>

type ReturnSummaryProps = {
  gst: string | undefined
  period: string
}

/** One GSTIN's month: what to check, GSTR-1 totals with its downloads, and GSTR-3B. */
export default function ReturnSummary({ gst, period }: ReturnSummaryProps) {
  // Hooks
  const copy = useCopy(gstReturnsContent)
  const locale = useLocale()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSummary(null)
    setError(null)
    api.gstInvoices.returns
      .summary({ period, gstRegistrationId: gst })
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : copy.failed)
      })
    return () => {
      cancelled = true
    }
  }, [gst, period, copy.failed])

  // Helpers
  const download = async (key: string, fn: () => Promise<File>) => {
    setBusy(key)
    try {
      saveFile(await fn())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleJson = () =>
    download('json', () => api.gstInvoices.returns.gstr1Json({ period, gstRegistrationId: gst }))
  const handleSummaryCsv = () =>
    download('csv', () => api.gstInvoices.returns.gstr1Csv({ period, gstRegistrationId: gst }))
  const handleTables = () =>
    download('zip', () => api.gstInvoices.gstr1({ ...monthRange(period), gstRegistrationId: gst }))
  const handle3bCsv = () =>
    download('3b-csv', () =>
      api.gstInvoices.returns.gstr3b({ period, gstRegistrationId: gst, format: 'csv' }),
    )
  const handle3bPdf = () =>
    download('3b-pdf', () =>
      api.gstInvoices.returns.gstr3b({ period, gstRegistrationId: gst, format: 'pdf' }),
    )

  // Early returns
  if (error) return <EmptyState variant="page" tone="danger" heading={copy.failed} body={error} />
  if (!summary) {
    return (
      <div role="status" className="flex flex-col gap-4" aria-label={copy.loading}>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Render logic
  const d = copy.downloads
  const disabled = busy !== null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-muted-foreground">
        {summary.legalName ? `${summary.legalName} · ` : ''}
        {summary.gstin} ·{' '}
        {summary.filedAt ? copy.filedOn(formatDate(summary.filedAt, locale)) : copy.notFiled}
      </p>
      <ReturnWarnings warnings={summary.warnings} />
      <Gstr1Card
        totals={summary.totals}
        documents={summary.documents}
        action={
          <span className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={disabled} onClick={handleTables}>
              {d.tableCsvs}
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={handleSummaryCsv}>
              {d.summaryCsv}
            </Button>
            <Button size="sm" disabled={disabled} onClick={handleJson} title={d.jsonHelp}>
              <Download />
              {d.json}
            </Button>
          </span>
        }
      />
      <p className="-mt-2 text-right text-caption text-muted-foreground">{d.jsonHelp}</p>
      <Gstr3bCard
        report={summary.gstr3b}
        action={
          <span className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" disabled={disabled} onClick={handle3bCsv}>
              {d.gstr3bCsv}
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={handle3bPdf}>
              <Download />
              {d.gstr3bPdf}
            </Button>
          </span>
        }
      />
    </div>
  )
}
