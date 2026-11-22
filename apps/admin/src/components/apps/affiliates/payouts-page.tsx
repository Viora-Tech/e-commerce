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
import TdsReportDialog from '@/components/apps/affiliates/tds-report-dialog'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import StatusChip from '@/components/layout/status-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { appsContent } from '@/data/apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

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
  const apps = useCopy(appsContent)
  const f = useFormat()
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [payouts, setPayouts] = useState<Payout[] | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  /** Which action is running: `create`, or the id of the payout being cancelled. */
  const [busy, setBusy] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    setLoadFailed(false)
    Promise.all([api.affiliates.payouts.candidates(), api.affiliates.payouts.list()]).then(
      ([c, p]) => {
        if (cancelled) return
        setCandidates(c)
        setPayouts(p)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [reload])

  // Helpers
  const run = async (action: string, fn: () => Promise<string>) => {
    setBusy(action)
    try {
      toast.success(await fn())
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(errorText(err, failed))
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleCreate = () =>
    run('create', async () => copy.created((await api.affiliates.payouts.create({})).created))
  const handleCancel = (id: string) =>
    run(id, async () => {
      await api.affiliates.payouts.cancel({ id })
      return copy.cancelled
    })
  const handleExport = async () => {
    try {
      const { csv } = await api.affiliates.payouts.exportCsv({})
      download(`affiliate-payouts-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    } catch (err) {
      toast.error(errorText(err, failed))
    }
  }

  // Early returns
  if ((!candidates || !payouts) && loadFailed) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.payouts}
          onRetry={() => setReload((n) => n + 1)}
        />
      </div>
    )
  }
  if (!candidates || !payouts) {
    // Header with its three buttons, the ready-to-pay and history tables.
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeaderSkeleton title={copy.title} actions={3} />
        <DataCardSkeleton fields={0} lines={3} />
        <DataCardSkeleton fields={0} lines={3} />
      </div>
    )
  }

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
            <Button variant="outline" onClick={() => setReporting(true)}>
              {copy.tdsReport}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={pending === 0}>
              {copy.export}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy !== null || ready === 0}
              loading={busy === 'create'}
            >
              {copy.create}
            </Button>
          </>
        }
      />
      <DataCard title={copy.readyTitle} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{cols.affiliate}</TableHead>
              <TableHead className={HEAD}>{cols.to}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.gross}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.clawback}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.gst}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.tds}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.net}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.length === 0 ? (
              <TableEmptyRow colSpan={7} message={copy.readyEmpty} />
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
                  {c.gstPaise ? f.money(c.gstPaise) : '—'}
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
      </DataCard>
      <DataCard title={copy.historyTitle} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{cols.affiliate}</TableHead>
              <TableHead className={HEAD}>{cols.status}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.net}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.gst}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{cols.tds}</TableHead>
              <TableHead className={HEAD}>{cols.created}</TableHead>
              <TableHead className={HEAD} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableEmptyRow colSpan={7} message={copy.historyEmpty} />
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
                  {p.gstPaise ? f.money(p.gstPaise) : '—'}
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
                        disabled={busy !== null}
                        loading={busy === p.id}
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
      </DataCard>
      <p className="text-caption text-muted-foreground">{copy.exportNote}</p>
      <TdsReportDialog open={reporting} onOpenChange={setReporting} onDownload={download} />
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
