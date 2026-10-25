'use client'

import { AppWindow, Send, SquarePlus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import CustomerAvatar from '@/components/customers/customer-avatar'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import SendMessageDialog, { type CustomMessage } from '@/components/orders/send-message-dialog'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { DRAFT_LIST_FILTERS, type DraftListFilter, draftsContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.orders.listDrafts>>
type Item = ListResult['items'][number]

export type DraftsInitial = {
  query: ListQuery<DraftListFilter>
  perPage: number
  result: ListResult
  tiles: Awaited<ReturnType<typeof api.orders.draftTiles>>
}

function draftColumns(copy: typeof draftsContent, fmt: Formatters): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'number',
      title: copy.columns.number,
      sortValue: (d) => d.number,
      hideable: false,
      className: 'w-24',
      render: (d) => <span className="font-medium tabular-nums">#{d.number}</span>,
    },
    {
      id: 'customer',
      title: copy.columns.customer,
      sortValue: (d) => d.customerName ?? d.email ?? '',
      render: (d) =>
        d.customerName || d.email ? (
          <span className="flex min-w-0 items-center gap-3">
            <CustomerAvatar
              name={d.customerName}
              email={d.email}
              className="size-6 bg-muted font-medium text-foreground"
            />
            <span className="truncate text-body text-ink-strong">{d.customerName ?? d.email}</span>
          </span>
        ) : (
          <span className="flex items-center gap-3 text-muted-foreground">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              –
            </span>
            {copy.guest}
          </span>
        ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (d) => d.lineCount,
      render: (d) => <span className="tabular-nums">{copy.itemCount(d.lineCount)}</span>,
    },
    {
      id: 'total',
      title: copy.columns.total,
      sortValue: (d) => d.totalPaise,
      align: 'end',
      render: (d) => <span className="font-medium tabular-nums">{fmt.money(d.totalPaise)}</span>,
    },
    {
      id: 'created',
      title: copy.columns.created,
      sortValue: (d) => new Date(d.createdAt).getTime(),
      sortLabels: { desc: copy.sortNewest, asc: copy.sortOldest },
      render: (d) => <span className="tabular-nums">{fmt.when(d.createdAt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (d) =>
        d.invoiceSentAt ? (
          <StatusChip tone="attention">{copy.status.invoiceSent}</StatusChip>
        ) : (
          <StatusChip tone="info">{copy.status.open}</StatusChip>
        ),
    },
  ]
}

function DraftsContent({ initial }: { initial: DraftsInitial }) {
  // Hooks
  const copy = useCopy(draftsContent)
  const fmt = useFormat()
  usePrimaryAction(routes.orders.newDraft())
  const [{ page, query, status, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      status: parseAsStringLiteral(DRAFT_LIST_FILTERS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(initial.perPage),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [tiles, setTiles] = useState(initial.tiles)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState<{ ids: string[]; clear: () => void } | null>(null)
  /** The draft whose "Send invoice" review dialog is open. */
  const [invoicing, setInvoicing] = useState<string | null>(null)
  /** Selected drafts waiting on the bulk "Send invoices" confirm. */
  const [sending, setSending] = useState<{ ids: string[]; clear: () => void } | null>(null)

  const hydrated = useRef(false)

  useEffect(() => {
    const size = parseRowsPerPage(rawPerPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      size === initial.perPage &&
      sameListQuery({ page, query, status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    api.orders
      .listDrafts({ page, perPage: size, search: query || undefined, status: status ?? undefined })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, rawPerPage, initial.query, initial.perPage])

  // Helpers
  const refresh = async () => {
    const [r, t] = await Promise.all([
      api.orders.listDrafts({
        page,
        perPage: parseRowsPerPage(rawPerPage),
        search: query || undefined,
        status: status ?? undefined,
      }),
      api.orders.draftTiles(),
    ])
    setItems(r.items)
    setTotal(r.total)
    setTiles(t)
  }

  // Event handlers
  const handleRemove = async () => {
    if (!removing) return
    try {
      const r = await api.orders.deleteDrafts({ ids: removing.ids })
      toast.success(copy.deleted(r.deleted))
      removing.clear()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.deleteFailed)
      throw err
    }
  }

  const handleSendOne = async (custom: CustomMessage | undefined) => {
    if (!invoicing) return
    try {
      const r = await api.orders.sendInvoice({ id: invoicing, custom })
      toast.success(copy.invoiceSentOne(r.sentTo))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.sendFailed)
    }
  }

  const handleSendMany = async () => {
    if (!sending) return
    try {
      const r = await api.orders.sendInvoices({ ids: sending.ids })
      toast.success(copy.sentMany(r.sent, r.skipped))
      sending.clear()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.sendFailed)
      throw err
    }
  }

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.intro}
      actions={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button render={<Link href={routes.orders.newDraft()} />} nativeButton={false}>
                <SquarePlus strokeWidth={1.6} />
                {copy.create}
              </Button>
            }
          />
          <TooltipContent>
            {copy.create} <Kbd>N</Kbd>
          </TooltipContent>
        </Tooltip>
      }
      stats={
        <StatStrip
          tiles={[
            {
              id: 'open',
              label: copy.tiles.open.label,
              value: fmt.number(tiles.open),
              note: copy.tiles.open.note,
            },
            {
              id: 'invoiced',
              label: copy.tiles.invoiced.label,
              value: fmt.number(tiles.invoiced),
              note: copy.tiles.invoiced.note,
            },
            {
              id: 'value',
              label: copy.tiles.value.label,
              value: fmt.money(tiles.valuePaise),
              note: copy.tiles.value.note(tiles.total),
            },
          ]}
        />
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={draftColumns(copy, fmt)}
        items={items}
        getId={(d) => d.id}
        href={(d) => routes.orders.draft(d.id)}
        rowActions={(d) => (
          <RowMenu
            items={[
              { label: copy.openDraft, href: routes.orders.draft(d.id), icon: AppWindow },
              {
                label: d.invoiceSentAt ? copy.resendInvoice : copy.sendInvoice,
                icon: Send,
                hidden: !d.email,
                onSelect: () => setInvoicing(d.id),
              },
              {
                label: copy.deleteDraft,
                icon: Trash2,
                destructive: true,
                onSelect: () => setRemoving({ ids: [d.id], clear: () => {} }),
              },
            ]}
          />
        )}
        selectable
        bulkActions={(ids, clear) => (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSending({ ids, clear })}
            >
              <Send aria-hidden="true" />
              {copy.sendSelected(ids.length)}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRemoving({ ids, clear })}
            >
              <Trash2 strokeWidth={1.6} aria-hidden="true" />
              {copy.deleteSelected(ids.length)}
            </Button>
          </>
        )}
        loading={loading}
        defaultSort={{ id: 'created', desc: true }}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        views={
          <ViewSelect<DraftListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            options={[
              { value: null, label: copy.tabs.all, count: tiles.total },
              { value: 'open', label: copy.tabs.open, count: tiles.open },
              { value: 'invoice_sent', label: copy.tabs.invoice_sent, count: tiles.invoiced },
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={query ? { heading: copy.noResults } : { heading: copy.empty, body: copy.intro }}
      />
      <SendMessageDialog
        orderId={invoicing}
        template="draft_invoice"
        onSend={handleSendOne}
        onClose={() => setInvoicing(null)}
      />
      {sending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setSending(null)}
          title={copy.sendTitle(sending.ids.length)}
          body={copy.sendBody}
          confirmLabel={copy.sendConfirm}
          cancelLabel={copy.cancel}
          tone="default"
          stopPropagation
          onConfirm={handleSendMany}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={copy.deleteTitle(removing.ids.length)}
          body={copy.deleteBody(removing.ids.length)}
          confirmLabel={copy.deleteDraft}
          cancelLabel={copy.cancel}
          stopPropagation
          onConfirm={handleRemove}
        />
      ) : null}
    </ProoflyListPage>
  )
}

export default function DraftsPage({ initial }: { initial: DraftsInitial }) {
  return (
    <Suspense>
      <DraftsContent initial={initial} />
    </Suspense>
  )
}
