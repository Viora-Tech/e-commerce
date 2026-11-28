'use client'

import { siteConfig } from '@commerce/config/site'
import type { IssueOn } from '@commerce/invoices'
import { CircleCheck, ReceiptIcon, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import SetupChecklist from '@/components/apps/setup-checklist'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import { hasFilter } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { appsContent } from '@/data/apps'
import { filterPanelContent } from '@/data/filter-panel'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { gstInvoiceActionsContent } from '@/data/gst-invoice-actions'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstListFiltersContent } from '@/data/gst-list-filters'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import {
  CLEAR_QUEUE_FILTERS,
  parseQueueSort,
  QUEUE_DEFAULT_SORT,
  QUEUE_PARAMS,
  queueFilterGroups,
  queueInput,
  sortParam,
} from '@/lib/gst-list-filters'
import { PAGE_FILL_CHAIN } from '@/lib/page-fill'
import { routes } from '@/lib/routes'
import AlreadyInvoicedDialog from './already-invoiced-dialog'
import FilingReminder from './filing-reminder'
import GstExportButton from './gst-export-button'
import { isReadyRow, type QueueRow, queueColumns } from './queue-columns'
import QueueEmpty from './queue-empty'
import { headerGstin, numberingYear } from './queue-meta'
import QueueMoreMenu from './queue-more-menu'
import ReviewPanel from './review-panel'
import { useGstNumbers } from './use-gst-numbers'

type Result = Awaited<ReturnType<typeof api.gstInvoices.queue.list>>

/** One issue batch at most (the API's limit): "Issue all" reviews the first 200 ready rows. */
const BATCH = 200

/**
 * The GST invoices Queue (Figma 928:10728): this month's figures, then every order waiting for
 * a tax invoice with its taxable value, GST and status, in the shared table (search, Filter,
 * sortable headers, views, rows per page; all on the server and kept in the URL). Ready rows
 * issue (the ticked ones, or every ready one from the header); the rest link to where the
 * problem is fixed. Issuing goes through the review step, which confirms each invoice date.
 */
export default function QueuePage() {
  return (
    <Suspense>
      <QueueList />
    </Suspense>
  )
}

function QueueList() {
  // Hooks
  const gstInvoicesCopy = useCopy(gstInvoicesContent)
  const copy = useCopy(gstQueuePageContent)
  const lists = useCopy(gstListFiltersContent)
  const panel = useCopy(filterPanelContent)
  const apps = useCopy(appsContent)
  const recordCopy = useCopy(gstAlreadyInvoicedContent)
  const actionsCopy = useCopy(gstInvoiceActionsContent)
  const fmt = useFormat()
  const router = useRouter()
  const numbers = useGstNumbers()
  const [q, setQ] = useQueryStates(QUEUE_PARAMS, { shallow: true })
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [result, setResult] = useState<Result | null>(null)
  /** The queue did not load: say so rather than show an empty queue. */
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [reviewing, setReviewing] = useState<QueueRow[] | null>(null)
  /** The row whose "Already invoiced" dialog is open. */
  const [recording, setRecording] = useState<QueueRow | null>(null)
  /** The ticked rows the bulk "Mark as already invoiced" confirm is open for. */
  const [marking, setMarking] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [gstin, setGstin] = useState<string | null | undefined>(undefined)
  /** The meta line's GSTIN: the seller's, else the store's (`headerGstin`); undefined loading. */
  const [shownGstin, setShownGstin] = useState<string | null | undefined>(undefined)
  const [issueOn, setIssueOn] = useState<IssueOn | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    api.gstInvoices.settings
      .get()
      .then((s) => {
        setGstin(s.settings.seller.gstin || null)
        setShownGstin(headerGstin(s.settings.seller.gstin, s.storeGstin))
        setIssueOn(s.settings.issueOn)
      })
      // A failed read leaves the GSTIN unknown; null would show the "add your GSTIN" checklist.
      .catch(() => undefined)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` refetches after a change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.gstInvoices.queue
      .list(queueInput(q, perPage))
      .then(
        (r) => {
          if (cancelled) return
          setResult(r)
          setFailed(false)
        },
        () => {
          if (!cancelled) setFailed(true)
        },
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, perPage, reloadKey])

  // Helpers
  const reload = () => {
    setPicked([])
    setReloadKey((k) => k + 1)
    // The sidebar's Queue count comes from the server layout: read it again too.
    router.refresh()
  }
  /** The ready rows among these ids on the page shown. */
  const readyAmong = (ids: string[]) =>
    (result?.rows ?? []).filter((r) => ids.includes(r.id) && isReadyRow(r))

  // Event handlers
  const handleRemove = async (ids: string[]) => {
    setBusy(true)
    try {
      await api.gstInvoices.queue.remove({ ids })
      reload()
    } catch (err) {
      toast.error(errorText(err, gstInvoicesCopy.queue.failed))
    } finally {
      setBusy(false)
    }
  }
  const handleMarkInvoiced = async () => {
    try {
      const r = await api.gstInvoices.queue.recordExternalMany({ ids: marking ?? [] })
      if (r?.recorded) toast.success(recordCopy.bulkDone(r.recorded))
      const [first] = r?.skipped ?? []
      if (first) toast.error(recordCopy.bulkSkipped(r?.skipped.length ?? 0, first.reason))
      setMarking(null)
      reload()
    } catch (err) {
      toast.error(errorText(err, recordCopy.bulkFailed))
      throw err
    }
  }
  /** The header's Issue all: every ready row (up to one batch); ticked rows issue from the bulk bar. */
  const handleIssueAll = async () => {
    setBusy(true)
    try {
      const ready = await api.gstInvoices.queue.list({
        ...queueInput(q, BATCH),
        view: 'ready',
        page: 1,
      })
      setReviewing(ready.rows)
    } catch (err) {
      toast.error(errorText(err, gstInvoicesCopy.queue.failed))
    } finally {
      setBusy(false)
    }
  }
  const handleIssueSelected = (ids: string[]) => {
    const ready = readyAmong(ids)
    if (ready.length) setReviewing(ready)
    else toast.error(lists.noneReadySelected)
  }
  const handleRecorded = () => {
    setRecording(null)
    reload()
  }
  const handleIssued = (n: number) => {
    toast.success(gstInvoicesCopy.queue.issued(n))
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
  const rows = result?.rows ?? []
  const counts = result?.counts ?? { all: 0, ready: 0, fix: 0, hsnMissing: 0 }
  const groups = queueFilterGroups(q, lists, panel, numbers, (patch) => setQ({ ...patch, page: 1 }))
  const narrowed = q.query !== '' || q.view !== null || groups.some(hasFilter)
  const toIssue = Math.min(counts.ready, BATCH)
  const year = numberingYear(new Date())
  /* Nothing waits at all: say how orders get here, in place of the table. */
  const queueEmpty = result !== null && !failed && counts.all === 0 && !narrowed

  return (
    <div className={cn('flex flex-col gap-4', PAGE_FILL_CHAIN)}>
      {/* One row like Orders: Export GSTR-1, the one "…" menu (with the app's Settings and
          Uninstall, registry `ownHeader`) and Issue all last. GSTIN and numbering are a meta line
          under the title, and Issue all steps aside while rows are ticked: the bulk bar issues
          them (owner, 28 Nov 2026). */}
      <PageHeader
        title={copy.title}
        summary={
          <span className="flex flex-col gap-1">
            <span>{copy.subtitle[issueOn ?? 'payment']}</span>
            {shownGstin === undefined ? null : (
              <span className="text-caption text-muted-foreground">
                {shownGstin ? copy.meta(shownGstin, year) : copy.metaNoGstin(year)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {/* Buttons first, the ⋯ menu last at the right with 1rem before it (owner, 28 Nov). */}
            <GstExportButton beforeMenu={picked.length > 0} />
            {picked.length === 0 ? (
              <Button className="mr-2" disabled={busy || toIssue === 0} onClick={handleIssueAll}>
                {copy.issueAll(toIssue)}
              </Button>
            ) : null}
            <QueueMoreMenu onAdded={reload} busy={busy} />
          </>
        }
      />
      {gstin === null ? (
        <SetupChecklist
          heading={gstInvoicesCopy.queue.setup.heading}
          body={gstInvoicesCopy.queue.setup.body}
          steps={[
            {
              label: gstInvoicesCopy.queue.setup.gstin,
              done: false,
              href: routes.apps.page('gst-invoices', 'settings'),
              action: gstInvoicesCopy.queue.setup.gstinAction,
            },
          ]}
        />
      ) : null}
      <FilingReminder />
      {queueEmpty ? (
        <QueueEmpty issueOn={issueOn} filtered={false} />
      ) : (
        <ResourceTable
          fill
          resourceName={lists.queueResource}
          columns={queueColumns({ queue: copy, lists, record: recordCopy }, fmt, {
            busy,
            onIssue: (r) => setReviewing([r]),
            onRecord: setRecording,
          })}
          items={rows}
          getId={(r) => r.id}
          loading={loading && result === null}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
          onClearAll={() => setQ({ ...CLEAR_QUEUE_FILTERS, view: null, page: 1 })}
          views={
            <ViewSelect
              value={q.view}
              onChange={(view) => setQ({ view, page: 1 })}
              pending={result === null}
              options={[
                { value: null, label: copy.chips.all, count: counts.all },
                { value: 'ready', label: copy.chips.ready, count: counts.ready },
                { value: 'fix', label: copy.chips.fix, count: counts.fix },
              ]}
            />
          }
          filterGroups={groups}
          defaultSort={QUEUE_DEFAULT_SORT}
          sort={parseQueueSort(q.sort)}
          onSortChange={(s) => setQ({ sort: sortParam(s, QUEUE_DEFAULT_SORT), page: 1 })}
          page={q.page}
          perPage={perPage}
          onPerPageChange={(next) => {
            setPerPage(next)
            setQ({ page: 1 })
          }}
          total={result?.total ?? 0}
          onPageChange={(page) => setQ({ page })}
          selection={{ ids: picked, onChange: setPicked }}
          bulkActions={(ids) => (
            <>
              <Button size="sm" disabled={busy} onClick={() => handleIssueSelected(ids)}>
                <ReceiptIcon />
                {lists.issueSelected(readyAmong(ids).length)}
              </Button>
              <ActionMenu
                label={actionsCopy.bulk.more}
                variant="outline"
                disabled={busy}
                items={[
                  {
                    label: recordCopy.bulkAction,
                    icon: CircleCheck,
                    onSelect: () => setMarking(ids),
                  },
                  {
                    label: actionsCopy.queueBulk.remove,
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => handleRemove(ids),
                  },
                ]}
              />
            </>
          )}
          empty={{ heading: q.view === 'ready' ? copy.noneReady : copy.noneToFix }}
          error={failed ? { heading: apps.couldNotLoad.queue, onRetry: () => reload() } : undefined}
        />
      )}
      <AlreadyInvoicedDialog
        key={recording?.id ?? 'closed'}
        row={recording}
        onClose={() => setRecording(null)}
        onRecorded={handleRecorded}
      />
      <ConfirmDialog
        open={marking !== null}
        onOpenChange={(open) => !open && setMarking(null)}
        title={recordCopy.bulkTitle(marking?.length ?? 0)}
        body={recordCopy.bulkBody}
        confirmLabel={recordCopy.bulkSubmit}
        tone="default"
        onConfirm={handleMarkInvoiced}
      />
    </div>
  )
}
