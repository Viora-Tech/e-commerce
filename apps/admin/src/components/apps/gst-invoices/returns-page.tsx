'use client'

import { formatInZone, IST_OFFSET_MS } from '@commerce/dates'
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
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import StatusChip from '@/components/layout/status-chip'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import GstNumberPicker from './gst-number-picker'
import { saveFile } from './save-file'
import { CELL, HEAD } from './table-classes'

type Period = Awaited<ReturnType<typeof api.gstInvoices.periods.list>>[number]

const copy = gstInvoicesContent.returns
const MONTHS_SHOWN = 12

/** The last twelve `YYYY-MM` months, newest first, in IST. */
function recentMonths(now = new Date()): string[] {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS),
    to: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
  }
}

const monthLabel = (period: string) =>
  formatInZone(
    monthRange(period).to.getTime() - 86_400_000,
    { month: 'long', year: 'numeric' },
    { timeZone: 'UTC' },
  )

/** GSTR-1 per month, with the filed and closed switches that lock a period. */
export default function ReturnsPage() {
  // Hooks
  const [periods, setPeriods] = useState<Period[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  // GSTR-1 is filed per GST number; undefined is the store's main one.
  const [gst, setGst] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    api.gstInvoices.periods.list({ gstRegistrationId: gst }).then((p) => {
      if (!cancelled) setPeriods(p)
    })
    return () => {
      cancelled = true
    }
  }, [gst])

  // Helpers
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
      setPeriods(await api.gstInvoices.periods.list({ gstRegistrationId: gst }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleExport = (period: string) =>
    run(`x-${period}`, async () =>
      saveFile(await api.gstInvoices.gstr1({ ...monthRange(period), gstRegistrationId: gst })),
    )
  const handleFiled = (period: string, filed: boolean) =>
    run(`f-${period}`, () =>
      api.gstInvoices.periods.setFiled({ period, filed, gstRegistrationId: gst }),
    )
  const handleClosed = (period: string, closed: boolean) =>
    run(`c-${period}`, () =>
      api.gstInvoices.periods.setClosed({ period, closed, gstRegistrationId: gst }),
    )

  // Render logic
  const byPeriod = new Map(periods.map((p) => [p.period, p]))

  return (
    <div className="flex flex-col gap-4">
      <ProoflyPageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<GstNumberPicker value={gst} onChange={setGst} />}
      />
      <div className="overflow-hidden rounded-xl surface-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.month}</TableHead>
              <TableHead className={`${HEAD} text-center`}>{copy.status}</TableHead>
              <TableHead className={`${HEAD} text-right`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentMonths().map((m) => {
              const p = byPeriod.get(m)
              const filed = Boolean(p?.gstr1FiledAt)
              const closed = Boolean(p?.closedAt)
              return (
                <TableRow key={m}>
                  <TableCell className={`${CELL} font-medium`}>{monthLabel(m)}</TableCell>
                  <TableCell className={`${CELL} text-center`}>
                    <StatusChip tone={filed || closed ? 'neutral' : 'attention'}>
                      {[filed ? copy.filed : null, closed ? copy.closed : null]
                        .filter(Boolean)
                        .join(', ') || copy.open}
                    </StatusChip>
                  </TableCell>
                  <TableCell className={CELL}>
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
        <p className="border-t border-line p-4 text-caption text-muted-foreground">{copy.note}</p>
      </div>
    </div>
  )
}
