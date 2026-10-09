'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import AbandonedTiles, { type AbandonedStats } from '@/components/abandoned/abandoned-tiles'
import StatusChip from '@/components/layout/status-chip'
import OrdersListFrame from '@/components/orders/orders-list-frame'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { abandonedContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.orders.listAbandoned>>
type Item = ListResult['items'][number]

export type AbandonedInitial = {
  page: number
  perPage: number
  result: ListResult
  stats: AbandonedStats
}

const statusOf = (c: Item) => (c.recovered ? 'recovered' : c.recoverySentAt ? 'sent' : 'open')

function AbandonedContent({ initial }: { initial: AbandonedInitial }) {
  // Hooks
  const copy = useCopy(abandonedContent)
  const fmt = useFormat()
  const [{ page, perPage: rawPerPage }, setQ] = useQueryStates(
    { page: parseAsInteger.withDefault(1), perPage: parseAsInteger.withDefault(initial.perPage) },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    const size = parseRowsPerPage(rawPerPage)
    if (page === initial.page && size === initial.perPage) return
    let cancelled = false
    setLoading(true)
    api.orders
      .listAbandoned({ page, perPage: size, sinceDays: 30 })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, rawPerPage, initial.page, initial.perPage])

  // Event handlers
  const handleSend = async (cartId: string) => {
    setSending(cartId)
    try {
      const r = await api.orders.sendRecovery({ cartId })
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

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const columns: ResourceColumnSpec<Item>[] = [
    {
      id: 'contact',
      title: copy.columns.contact,
      align: 'start',
      hideable: false,
      sortValue: (c) => c.email ?? c.phone ?? '',
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-body-strong text-foreground">
            {c.customerName ?? c.email ?? c.phone ?? copy.anonymous}
          </span>
          {c.email ? (
            <span className="block truncate text-caption text-muted-foreground">{c.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (c) => c.itemCount,
      render: (c) => <span className="tabular-nums">{copy.itemCount(c.itemCount)}</span>,
    },
    {
      id: 'value',
      title: copy.columns.value,
      sortValue: (c) => c.subtotalPaise,
      align: 'end',
      render: (c) => <span className="font-medium tabular-nums">{fmt.money(c.subtotalPaise)}</span>,
    },
    {
      id: 'activity',
      title: copy.columns.activity,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => <span className="tabular-nums">{fmt.when(c.updatedAt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (c) => (
        <StatusChip tone={statusOf(c) === 'open' ? 'attention' : 'neutral'}>
          {copy.status[statusOf(c)]}
        </StatusChip>
      ),
    },
    {
      id: 'action',
      title: '',
      hideable: false,
      render: (c) =>
        c.recovered || !c.email ? null : (
          <Button
            variant="outline"
            size="sm"
            disabled={sending === c.id}
            onClick={() => handleSend(c.id)}
          >
            {sending === c.id ? copy.sending : copy.send}
          </Button>
        ),
    },
  ]

  return (
    <OrdersListFrame
      title={copy.heading}
      summary={copy.intro}
      tiles={<AbandonedTiles stats={initial.stats} />}
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(c) => c.id}
        loading={loading}
        query=""
        onQueryChange={() => undefined}
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={{ heading: copy.empty, body: copy.intro }}
      />
    </OrdersListFrame>
  )
}

export default function AbandonedPage({ initial }: { initial: AbandonedInitial }) {
  return (
    <Suspense>
      <AbandonedContent initial={initial} />
    </Suspense>
  )
}
