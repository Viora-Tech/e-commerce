'use client'

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
import StatusChip from '@/components/layout/status-chip'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { monthLabel, recentMonths } from './return-months'
import { CELL, HEAD } from './table-classes'

type Period = Awaited<ReturnType<typeof api.gstInvoices.periods.list>>[number]

type PeriodsTableProps = {
  gst: string | undefined
  /** The month the page shows; its row is marked. */
  selected: string
  onSelect: (period: string) => void
  /** A month was marked filed or reopened: the summary above reloads. */
  onChanged: () => void
}

/** The last twelve months with the filed and closed switches that lock a period. */
export default function PeriodsTable({ gst, selected, onSelect, onChanged }: PeriodsTableProps) {
  // Hooks
  const copy = useCopy(gstReturnsContent)
  const [periods, setPeriods] = useState<Period[]>([])
  const [busy, setBusy] = useState<string | null>(null)

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
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleFiled = (period: string, filed: boolean) =>
    run(`f-${period}`, () =>
      api.gstInvoices.periods.setFiled({ period, filed, gstRegistrationId: gst }),
    )
  const handleClosed = (period: string, closed: boolean) =>
    run(`c-${period}`, () =>
      api.gstInvoices.periods.setClosed({ period, closed, gstRegistrationId: gst }),
    )

  // Render logic
  const p = copy.periods
  const byPeriod = new Map(periods.map((row) => [row.period, row]))

  return (
    <DataCard title={p.title} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD}>{p.month}</TableHead>
            <TableHead className={`${HEAD} text-center`}>{p.status}</TableHead>
            <TableHead className={`${HEAD} text-right`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {recentMonths().map((m) => {
            const row = byPeriod.get(m)
            const filed = Boolean(row?.gstr1FiledAt)
            const closed = Boolean(row?.closedAt)
            return (
              <TableRow key={m} data-state={m === selected ? 'selected' : undefined}>
                <TableCell className={`${CELL} font-medium`}>{monthLabel(m)}</TableCell>
                <TableCell className={`${CELL} text-center`}>
                  <StatusChip tone={filed || closed ? 'neutral' : 'attention'}>
                    {[filed ? p.filed : null, closed ? p.closed : null]
                      .filter(Boolean)
                      .join(', ') || p.open}
                  </StatusChip>
                </TableCell>
                <TableCell className={CELL}>
                  <span className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={m === selected}
                      onClick={() => onSelect(m)}
                    >
                      {p.view}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => handleFiled(m, !filed)}
                    >
                      {filed ? p.unmarkFiled : p.markFiled}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => handleClosed(m, !closed)}
                    >
                      {closed ? p.reopen : p.close}
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="px-5 pt-4 text-caption text-muted-foreground">{p.note}</p>
    </DataCard>
  )
}
