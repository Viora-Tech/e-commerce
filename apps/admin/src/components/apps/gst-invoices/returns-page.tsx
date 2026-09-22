'use client'

import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { saveFile } from './save-file'

type Period = Awaited<ReturnType<typeof api.gstInvoices.periods.list>>[number]

const copy = gstInvoicesContent.returns
const IST_MS = 330 * 60 * 1000
const MONTHS_SHOWN = 12

/** The last twelve `YYYY-MM` months, newest first, in IST. */
function recentMonths(now = new Date()): string[] {
  const ist = new Date(now.getTime() + IST_MS)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - IST_MS),
    to: new Date(Date.UTC(y, m, 1) - IST_MS),
  }
}

const monthLabel = (period: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    monthRange(period).to.getTime() - 86_400_000,
  )

/** GSTR-1 per month, with the filed and closed switches that lock a period. */
export default function ReturnsPage() {
  // Hooks
  const [periods, setPeriods] = useState<Period[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api.gstInvoices.periods.list().then(setPeriods)
  }, [])

  // Helpers
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
      setPeriods(await api.gstInvoices.periods.list())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleExport = (period: string) =>
    run(`x-${period}`, async () => saveFile(await api.gstInvoices.gstr1(monthRange(period))))
  const handleFiled = (period: string, filed: boolean) =>
    run(`f-${period}`, () => api.gstInvoices.periods.setFiled({ period, filed }))
  const handleClosed = (period: string, closed: boolean) =>
    run(`c-${period}`, () => api.gstInvoices.periods.setClosed({ period, closed }))

  // Render logic
  const byPeriod = new Map(periods.map((p) => [p.period, p]))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <DataCard title={copy.title} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.month}</TableHead>
              <TableHead>{copy.status}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentMonths().map((m) => {
              const p = byPeriod.get(m)
              const filed = Boolean(p?.gstr1FiledAt)
              const closed = Boolean(p?.closedAt)
              return (
                <TableRow key={m}>
                  <TableCell className="font-medium">{monthLabel(m)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[filed ? copy.filed : null, closed ? copy.closed : null]
                      .filter(Boolean)
                      .join(', ') || copy.open}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => handleExport(m)}
                      >
                        <Download />
                        {copy.export}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => handleFiled(m, !filed)}
                      >
                        {filed ? copy.unmarkFiled : copy.markFiled}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => handleClosed(m, !closed)}
                      >
                        {closed ? copy.reopen : copy.close}
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="p-4 text-caption text-muted-foreground">{copy.note}</p>
      </DataCard>
    </div>
  )
}
