'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import AbandonedTiles, { type AbandonedStats } from '@/components/abandoned/abandoned-tiles'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { abandonedContent as copy } from '@/data/drafts'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.orders.listAbandoned>>
type Item = ListResult['items'][number]

export type AbandonedInitial = { page: number; result: ListResult; stats: AbandonedStats }

const statusOf = (c: Item) => (c.recovered ? 'recovered' : c.recoverySentAt ? 'sent' : 'open')

function AbandonedContent({ initial }: { initial: AbandonedInitial }) {
  // Hooks
  const [{ page }, setQ] = useQueryStates(
    { page: parseAsInteger.withDefault(1) },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    if (page === initial.page) return
    let cancelled = false
    setLoading(true)
    api.orders
      .listAbandoned({ page, perPage: LIST_PER_PAGE, sinceDays: 30 })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, initial.page])

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
      render: (c) => <span className="tabular-nums">{formatPaise(c.subtotalPaise)}</span>,
    },
    {
      id: 'activity',
      title: copy.columns.activity,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => <RelativeTime value={c.updatedAt} />,
    },
    {
      id: 'status',
      title: copy.columns.status,
      render: (c) => <StatusLabel kind="abandoned" value={statusOf(c)} />,
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
    <PageBody width="frame" className="gap-6">
      <PageHeader title={copy.heading} subtitle={copy.intro} />
      <AbandonedTiles stats={initial.stats} />
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(c) => c.id}
        loading={loading}
        query=""
        onQueryChange={() => undefined}
        page={page}
        perPage={LIST_PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        empty={{ heading: copy.empty, body: copy.intro }}
      />
    </PageBody>
  )
}

export default function AbandonedPage({ initial }: { initial: AbandonedInitial }) {
  return (
    <Suspense>
      <AbandonedContent initial={initial} />
    </Suspense>
  )
}
