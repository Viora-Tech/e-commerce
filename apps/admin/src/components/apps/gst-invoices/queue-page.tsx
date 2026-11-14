'use client'

import type { IssueOn } from '@commerce/invoices'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SetupChecklist from '@/components/apps/setup-checklist'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import InlineState from '@/components/states/inline-state'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { statesContent } from '@/data/states'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GstNumberPicker from './gst-number-picker'
import QueueEmpty from './queue-empty'
import QueueMoreMenu, { type DateRange } from './queue-more-menu'
import QueueRowView from './queue-row'
import QueueStats from './queue-stats'
import ReviewPanel from './review-panel'
import { HEAD } from './table-classes'

export type QueueRow = Awaited<ReturnType<typeof api.gstInvoices.queue.list>>[number]

type Chip = 'all' | 'ready' | 'fix'

const istStart = (day: string) => (day ? new Date(`${day}T00:00:00+05:30`) : undefined)
const istEnd = (day: string) =>
  day ? new Date(new Date(`${day}T00:00:00+05:30`).getTime() + 86_400_000) : undefined

const isReady = (r: QueueRow) => r.status.startsWith('ready')

/**
 * The GST invoices Queue (Figma 928:10728): this month's figures, then every order waiting for
 * a tax invoice with its taxable value, GST and status. Ready rows issue (all at once from the
 * header, or one by one); the rest link to where the problem is fixed. Issuing goes through the
 * review step, which confirms each invoice date before numbers are given.
 */
export default function QueuePage() {
  // Hooks
  const copy = useCopy(gstQueuePageContent)
  const fmt = useFormat()
  const states = useCopy(statesContent)
  const [rows, setRows] = useState<QueueRow[] | null>(null)
  /** The queue did not load: say so rather than show an empty queue. */
  const [failed, setFailed] = useState(false)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [chip, setChip] = useState<Chip>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState<QueueRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [gstin, setGstin] = useState<string | null | undefined>(undefined)
  const [gst, setGst] = useState<string | undefined>(undefined)
  const [issueOn, setIssueOn] = useState<IssueOn | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    api.gstInvoices.settings
      .get()
      .then((s) => {
        setGstin(s.settings.seller.gstin || null)
        setIssueOn(s.settings.issueOn)
      })
      // A failed read leaves the GSTIN unknown; null would show the "add your GSTIN" checklist.
      .catch(() => undefined)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` refetches after a change
  useEffect(() => {
    let cancelled = false
    api.gstInvoices.queue
      .list({ from: istStart(range.from), to: istEnd(range.to), gstRegistrationId: gst })
      .then(
        (r) => {
          if (cancelled) return
          setRows(r)
          setFailed(false)
        },
        () => {
          if (!cancelled) setFailed(true)
        },
      )
    return () => {
      cancelled = true
    }
  }, [range, gst, reloadKey])

  // Helpers
  const reload = () => {
    setPicked(new Set())
    setReloadKey((k) => k + 1)
  }

  // Event handlers
  const handleToggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const handleRemove = async () => {
    setBusy(true)
    try {
      await api.gstInvoices.queue.remove({ ids: [...picked] })
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : gstInvoicesContent.queue.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleGst = (id: string | undefined) => {
    setGst(id)
    setPicked(new Set())
  }
  const handleIssued = (n: number) => {
    toast.success(gstInvoicesContent.queue.issued(n))
    setReviewing(null)
    reload()
  }

  // Early returns
  if (reviewing) {
    return (
      <ReviewPanel rows={reviewing} onBack={() => setReviewing(null)} onIssued={handleIssued} />
    )
  }

  // Render logic
  const list = rows ?? []
  const ready = list.filter(isReady)
  const toFix = list.filter((r) => !isReady(r))
  const shown = chip === 'ready' ? ready : chip === 'fix' ? toFix : list
  const filtered = Boolean(range.from || range.to)
  const empty = rows !== null && list.length === 0
  // The header issues the ticked ready rows, else every ready row.
  const pickedReady = ready.filter((r) => picked.has(r.id))
  const toIssue = pickedReady.length ? pickedReady : ready
  const pickable = shown
  const allOn = pickable.length > 0 && pickable.every((r) => picked.has(r.id))
  const fromLabel = range.from ? fmt.date(`${range.from}T12:00:00+05:30`) : ''
  const toLabel = range.to ? fmt.date(`${range.to}T12:00:00+05:30`) : ''

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle[issueOn ?? 'payment']}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <GstNumberPicker value={gst} onChange={handleGst} allowAll />
            <QueueMoreMenu
              range={range}
              onRange={setRange}
              pickedCount={picked.size}
              onRemove={handleRemove}
              onAdded={reload}
              busy={busy}
            />
            <Button disabled={busy || toIssue.length === 0} onClick={() => setReviewing(toIssue)}>
              {copy.issueMany(toIssue.length)}
            </Button>
          </span>
        }
      />
      {gstin === null ? (
        <SetupChecklist
          heading={gstInvoicesContent.queue.setup.heading}
          body={gstInvoicesContent.queue.setup.body}
          steps={[
            {
              label: gstInvoicesContent.queue.setup.gstin,
              done: false,
              href: routes.apps.page('gst-invoices', 'settings'),
              action: gstInvoicesContent.queue.setup.gstinAction,
            },
          ]}
        />
      ) : null}
      <QueueStats
        gst={gst}
        waiting={rows === null ? null : list.length}
        needHsn={list.filter((r) => r.status === 'hsn_missing').length}
        needFix={toFix.length}
        reloadKey={reloadKey}
      />
      <div className="overflow-hidden rounded-xl surface-card">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <PillTabs<Chip>
            variant="pill"
            value={chip}
            onChange={setChip}
            tabs={[
              { value: 'all', label: copy.chips.all, count: list.length },
              { value: 'ready', label: copy.chips.ready, count: ready.length },
              { value: 'fix', label: copy.chips.fix, count: toFix.length },
            ]}
          />
          {filtered ? (
            <Button
              size="sm"
              variant="outline"
              aria-label={copy.clearDates}
              onClick={() => setRange({ from: '', to: '' })}
            >
              {copy.dateRange(fromLabel, toLabel)}
              <X aria-hidden="true" />
            </Button>
          ) : null}
          {picked.size ? (
            <span className="ml-auto text-caption text-muted-foreground">
              {copy.selected(picked.size)}
            </span>
          ) : null}
        </div>
        {failed ? (
          <InlineState kind="error" className="border-line border-t" onRetry={reload} />
        ) : empty ? (
          <QueueEmpty issueOn={issueOn} filtered={filtered} />
        ) : shown.length === 0 && rows !== null ? (
          <p className="border-line border-t px-4 py-8 text-center text-body text-muted-foreground">
            {chip === 'ready' ? copy.noneReady : copy.noneToFix}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`${HEAD} w-10`}>
                  <Checkbox
                    checked={allOn}
                    disabled={pickable.length === 0}
                    aria-label={copy.selectAll}
                    onCheckedChange={(v) =>
                      setPicked(v ? new Set(pickable.map((r) => r.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead className={HEAD}>{copy.columns.order}</TableHead>
                <TableHead className={HEAD}>{copy.columns.customer}</TableHead>
                <TableHead className={HEAD}>{copy.columns.gstin}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{copy.columns.taxable}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{copy.columns.gst}</TableHead>
                <TableHead className={HEAD}>{copy.columns.status}</TableHead>
                <TableHead className={HEAD}>
                  <span className="sr-only">{copy.columns.action}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                <TableSkeletonRows columns={8} rows={4} label={states.loading} />
              ) : null}
              {shown.map((r) => (
                <QueueRowView
                  key={r.id}
                  row={r}
                  picked={picked.has(r.id)}
                  busy={busy}
                  onPick={(on) => handleToggle(r.id, on)}
                  onIssue={() => setReviewing([r])}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
