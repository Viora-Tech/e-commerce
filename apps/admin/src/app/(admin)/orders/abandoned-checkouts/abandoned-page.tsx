'use client'

import { AppWindow, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { abandonedColumns } from '@/components/abandoned/abandoned-columns'
import AbandonedTiles, { type AbandonedStats } from '@/components/abandoned/abandoned-tiles'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import SendMessageDialog, { type CustomMessage } from '@/components/orders/send-message-dialog'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import {
  ABANDONED_LIST_FILTERS,
  type AbandonedListFilter,
  abandonedBulkContent,
  abandonedContent,
} from '@/data/drafts'
import { filterPanelContent } from '@/data/filter-panel'
import { abandonedFiltersContent } from '@/data/order-list-filters'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  ABANDONED_FILTER_PARAMS,
  type AbandonedFilters,
  abandonedFilterGroups,
  abandonedFilterInput,
  CLEAR_ABANDONED_FILTERS,
  hasAbandonedFilters,
} from '@/lib/abandoned-list-filters'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import { runBatched } from '@/lib/run-batched'

type ListResult = Awaited<ReturnType<typeof api.orders.listAbandoned>>
type Item = ListResult['items'][number]

export type AbandonedInitial = {
  query: ListQuery<AbandonedListFilter>
  perPage: number
  result: ListResult
  stats: AbandonedStats
  /** Whole-window (30 day) counts for the tabs; `stats` is the 7 day figures for the tiles. */
  counts: AbandonedStats
}

type Query = ListQuery<AbandonedListFilter> & AbandonedFilters

/** The list looks 30 days back unless the Last active filter says otherwise. */
function fetchAbandoned(q: Query, perPage: number) {
  return api.orders.listAbandoned({
    page: q.page,
    perPage,
    sinceDays: 30,
    status: q.status ?? undefined,
    search: q.query || undefined,
    ...abandonedFilterInput(q),
  })
}

/** A recovery can go out: the shopper left an email and has not bought the cart since. */
const recoverable = (c: Item) => !c.recovered && Boolean(c.email)

/** The API's refusal for a shopper who has not agreed to marketing messages (`sendRecovery`). */
const noConsent = (err: unknown) => err instanceof Error && /agreed to marketing/i.test(err.message)

function AbandonedContent({ initial }: { initial: AbandonedInitial }) {
  // Hooks
  const copy = useCopy(abandonedContent)
  const bulkCopy = useCopy(abandonedBulkContent)
  const filterCopy = useCopy(abandonedFiltersContent)
  const _panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      status: parseAsStringLiteral(ABANDONED_LIST_FILTERS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(initial.perPage),
      ...ABANDONED_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  /** The cart whose "Send reminder" review dialog is open. */
  const [reviewing, setReviewing] = useState<string | null>(null)
  /** Selected carts waiting on the bulk "Send recovery" confirm. */
  const [bulk, setBulk] = useState<{ ids: string[]; clear: () => void } | null>(null)

  const hydrated = useRef(false)

  useEffect(() => {
    const size = parseRowsPerPage(q.perPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      size === initial.perPage &&
      !hasAbandonedFilters(q) &&
      sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    fetchAbandoned(q, size)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query, initial.perPage])

  // Helpers
  /** Sends one recovery per cart, ten at a time; a refusal never stops the rest. */
  const sendRecoveries = async (carts: Item[]) => {
    let sent = 0
    let declined = 0
    const r = await runBatched(
      carts.map((c) => c.id),
      async (cartId) => {
        try {
          await api.orders.sendRecovery({ cartId })
        } catch (err) {
          if (!noConsent(err)) throw err
          declined += 1
          return
        }
        sent += 1
        setItems((list) =>
          list.map((x) => (x.id === cartId ? { ...x, recoverySentAt: new Date() } : x)),
        )
      },
    )
    return { sent, noConsent: declined, failed: r.failed }
  }

  // Event handlers
  const handleSend = async (cartId: string, custom?: CustomMessage) => {
    setSending(cartId)
    try {
      const r = await api.orders.sendRecovery({ cartId, custom })
      toast.success(copy.sent(r.sent))
      setItems((list) =>
        list.map((c) => (c.id === cartId ? { ...c, recoverySentAt: new Date() } : c)),
      )
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.sendFailed)
    } finally {
      setSending(null)
    }
  }

  const handleSendAll = async () => {
    const due = items.filter((c) => recoverable(c) && !c.recoverySentAt)
    if (due.length === 0) {
      toast.info(copy.nothingToSend)
      return
    }
    setSending('all')
    const r = await sendRecoveries(due)
    setSending(null)
    toast.success(copy.remindersDone(r.sent))
  }

  const handleSendSelected = async () => {
    if (!bulk) return
    const picked = new Set(bulk.ids)
    const due = items.filter((c) => picked.has(c.id) && recoverable(c))
    const r = await sendRecoveries(due)
    const summary = bulkCopy.done(r.sent, bulk.ids.length - due.length, r.noConsent, r.failed)
    if (r.sent > 0) toast.success(summary)
    else toast.info(summary)
    bulk.clear()
  }

  // Render logic
  const { page, query, status } = q
  const perPage = parseRowsPerPage(q.perPage)
  const filtered = hasAbandonedFilters(q)
  const groups = abandonedFilterGroups(q, filterCopy, (patch) => setQ({ ...patch, page: 1 }))
  const columns = abandonedColumns(copy, fmt)

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary(
        initial.stats.carts,
        initial.stats.recovered,
        fmt.money(initial.stats.valuePaise),
      )}
      actions={
        <Button loading={sending === 'all'} onClick={handleSendAll}>
          <Send aria-hidden="true" />
          {copy.sendReminders}
        </Button>
      }
      stats={
        <AbandonedTiles
          stats={initial.stats}
          status={status}
          onSelect={(s) => setQ({ status: s, page: 1 })}
        />
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(c) => c.id}
        href={(c) => routes.orders.abandonedCheckout(c.id)}
        loading={loading}
        rowActions={(c) => (
          <RowMenu
            items={[
              { label: copy.view, href: routes.orders.abandonedCheckout(c.id), icon: AppWindow },
              ...(c.recovered || !c.email
                ? []
                : [{ label: copy.send, onSelect: () => setReviewing(c.id), icon: Send }]),
            ]}
          />
        )}
        selectable
        bulkActions={(ids, clear) => (
          <Button type="button" variant="outline" size="sm" onClick={() => setBulk({ ids, clear })}>
            <Send aria-hidden="true" />
            {bulkCopy.send(ids.length)}
          </Button>
        )}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setQ({ ...CLEAR_ABANDONED_FILTERS, query: '', status: null, page: 1 })}
        filterGroups={groups}
        views={
          <ViewSelect<AbandonedListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            options={[
              { value: null, label: copy.tabs.all, count: initial.counts.carts },
              {
                value: 'not_recovered',
                label: copy.tabs.not_recovered,
                count: initial.counts.notRecovered,
              },
              {
                value: 'reminder_sent',
                label: copy.tabs.reminder_sent,
                count: initial.counts.remindersSent,
              },
              { value: 'recovered', label: copy.tabs.recovered, count: initial.counts.recovered },
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={filtered ? { heading: copy.empty } : { heading: copy.empty, body: copy.intro }}
      />
      {bulk ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setBulk(null)}
          title={bulkCopy.title(bulk.ids.length)}
          body={bulkCopy.body}
          confirmLabel={bulkCopy.confirm}
          tone="default"
          stopPropagation
          onConfirm={handleSendSelected}
        />
      ) : null}
      <SendMessageDialog
        orderId={reviewing}
        template="checkout_recovery"
        onSend={(custom) => (reviewing ? handleSend(reviewing, custom) : Promise.resolve())}
        onClose={() => setReviewing(null)}
      />
    </ProoflyListPage>
  )
}

export default function AbandonedPage({ initial }: { initial: AbandonedInitial }) {
  return (
    <Suspense>
      <AbandonedContent initial={initial} />
    </Suspense>
  )
}
