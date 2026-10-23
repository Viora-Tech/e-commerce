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
import MarkPaidDialog from '@/components/apps/affiliates/mark-paid-dialog'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Candidate = Awaited<ReturnType<typeof api.affiliates.payouts.candidates>>[number]
type Payout = Awaited<ReturnType<typeof api.affiliates.payouts.list>>[number]

/** Saves text as a file in the browser (the bank CSV); nothing leaves except to the merchant's disk. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Who is owed, the payouts made from it, the bank file and "Mark paid". No money moves here. */
export default function PayoutsPage() {
  // Hooks
  const { payouts: copy, failed } = useCopy(affiliatesContent)
  const f = useFormat()
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [payouts, setPayouts] = useState<Payout[] | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    Promise.all([api.affiliates.payouts.candidates(), api.affiliates.payouts.list()]).then(
      ([c, p]) => {
        if (cancelled) return
        setCandidates(c)
        setPayouts(p)
      },
    )
    return () => {
      cancelled = true
    }
  }, [reload])

  // Helpers
  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try {
      toast.success(await fn())
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleCreate = () =>
    run(async () => copy.created((await api.affiliates.payouts.create({})).created))
  const handleCancel = (id: string) =>
    run(async () => {
      await api.affiliates.payouts.cancel({ id })
      return copy.cancelled
    })
  const handleExport = async () => {
    try {
      const { csv } = await api.affiliates.payouts.exportCsv({})
      download(`affiliate-payouts-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Early returns
  if (!candidates || !payouts) return null

  // Render logic
  const ready = candidates.filter((c) => c.ready).length
  const pending = payouts.filter((p) => p.status === 'pending').length
  const cols = copy.columns

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={pending === 0}>
              {copy.export}
            </Button>
            <Button onClick={handleCreate} disabled={busy || ready === 0}>
              {copy.create}
            </Button>
          </>
        }
      />
      <div className="overflow-hidden rounded-xl surface-card">
        <h2 className="px-6 pt-5 pb-3 text-body font-semibold text-ink-strong">
          {copy.readyTitle}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{cols.affiliate}</TableHead>
              <TableHead className={HEAD}>{cols.to}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.gross}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.clawback}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.tds}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.net}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.length === 0 ? (
              <TableEmptyRow colSpan={6} message={copy.readyEmpty} />
            ) : null}
            {candidates.map((c) => (
              <TableRow key={c.affiliateId}>
                <TableCell className={`${CELL} font-medium`}>{c.name || c.code}</TableCell>
                <TableCell className={CELL}>
                  {c.blocker ? (
                    <StatusChip tone="attention">{copy.blockers[c.blocker]}</StatusChip>
                  ) : (
                    c.payoutHint
                  )}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(c.grossPaise)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {c.clawbackPaise ? f.money(-c.clawbackPaise) : '—'}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(c.tdsPaise)}
                </TableCell>
                <TableCell className={`${CELL} text-right font-medium tabular-nums`}>
                  {f.money(c.netPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="overflow-hidden rounded-xl surface-card">
        <h2 className="px-6 pt-5 pb-3 text-body font-semibold text-ink-strong">
          {copy.historyTitle}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{cols.affiliate}</TableHead>
              <TableHead className={HEAD}>{cols.status}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.net}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.tds}</TableHead>
              <TableHead className={HEAD}>{cols.created}</TableHead>
              <TableHead className={HEAD} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableEmptyRow colSpan={6} message={copy.historyEmpty} />
            ) : null}
            {payouts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className={`${CELL} font-medium`}>{p.name || p.code}</TableCell>
                <TableCell className={CELL}>
                  <StatusChip tone={p.status === 'paid' ? 'success' : 'attention'}>
                    {copy.payoutStatus[p.status] ?? p.status}
                  </StatusChip>
                  {p.reference ? (
                    <span className="ml-2 text-caption text-muted-foreground">{p.reference}</span>
                  ) : null}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(p.netPaise)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(p.tdsPaise)}
                </TableCell>
                <TableCell className={CELL}>{f.date(p.createdAt)}</TableCell>
                <TableCell className={`${CELL} text-right`}>
                  {p.status === 'pending' ? (
                    <span className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(p.id)}
                        disabled={busy}
                      >
                        {copy.cancel}
                      </Button>
                      <Button size="sm" onClick={() => setPaying(p.id)}>
                        {copy.markPaid}
                      </Button>
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-caption text-muted-foreground">{copy.exportNote}</p>
      <MarkPaidDialog
        payoutId={paying}
        onOpenChange={(open) => {
          if (!open) setPaying(null)
        }}
        onPaid={() => setReload((n) => n + 1)}
      />
    </div>
  )
}
