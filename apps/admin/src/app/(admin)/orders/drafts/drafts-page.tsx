'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import CustomerAvatar from '@/components/customers/customer-avatar'
import PillTabs from '@/components/layout/pill-tabs'
import StatTile from '@/components/layout/stat-tile'
import StatusChip from '@/components/layout/status-chip'
import OrdersListFrame from '@/components/orders/orders-list-frame'
import RowMenu from '@/components/orders/row-menu'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
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
            <CustomerAvatar name={d.customerName} email={d.email} />
            <span className="truncate">{d.customerName ?? d.email}</span>
          </span>
        ) : (
          <span className="flex items-center gap-3 text-muted-foreground">
            <span className="size-8 shrink-0 rounded-full border border-dashed border-border-strong" />
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
  const [loading, setLoading] = useState(false)

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

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const tiles = initial.tiles

  return (
    <OrdersListFrame
      title={copy.heading}
      summary={copy.intro}
      actions={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button render={<Link href={routes.orders.newDraft()} />} nativeButton={false}>
                <Plus />
                {copy.create}
              </Button>
            }
          />
          <TooltipContent>
            {copy.create} <Kbd>N</Kbd>
          </TooltipContent>
        </Tooltip>
      }
      tiles={
        <>
          <StatTile
            label={copy.tiles.open.label}
            value={fmt.number(tiles.open)}
            note={copy.tiles.open.note}
          />
          <StatTile
            label={copy.tiles.invoiced.label}
            value={fmt.number(tiles.invoiced)}
            note={copy.tiles.invoiced.note}
          />
          <StatTile
            label={copy.tiles.value.label}
            value={fmt.money(tiles.valuePaise)}
            note={copy.tiles.value.note(tiles.total)}
          />
        </>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={draftColumns(copy, fmt)}
        items={items}
        getId={(d) => d.id}
        href={(d) => routes.orders.draft(d.id)}
        rowActions={(d) => (
          <RowMenu items={[{ label: copy.openDraft, href: routes.orders.draft(d.id) }]} />
        )}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs<DraftListFilter | null>
            variant="segmented"
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            tabs={[
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
    </OrdersListFrame>
  )
}

export default function DraftsPage({ initial }: { initial: DraftsInitial }) {
  return (
    <Suspense>
      <DraftsContent initial={initial} />
    </Suspense>
  )
}
