'use client'

import { Badge, ChoiceList, Page, Text } from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { ResourceTable, type ResourceTableColumn } from '@/components/resource-table'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Item = Awaited<ReturnType<typeof api.orders.list>>['items'][number]

const STATUS = ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] as const
const PER_PAGE = 25

const tone: Record<Item['status'], 'attention' | 'success' | 'info' | 'critical' | undefined> = {
  placed: 'attention',
  paid: 'info',
  fulfilled: 'success',
  delivered: 'success',
  cancelled: 'critical',
}

const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1)

const columns: ResourceTableColumn<Item>[] = [
  {
    id: 'number',
    title: 'Order',
    render: (o) => (
      <Text as="span" fontWeight="semibold">
        #{o.number}
      </Text>
    ),
  },
  {
    id: 'date',
    title: 'Date',
    render: (o) => <Text as="span">{new Date(o.placedAt).toLocaleString('en-IN')}</Text>,
  },
  {
    id: 'customer',
    title: 'Customer',
    render: (o) => <Text as="span">{o.customerName ?? o.email ?? 'Guest'}</Text>,
  },
  {
    id: 'total',
    title: 'Total',
    alignment: 'end',
    render: (o) => <Text as="span">{formatPaise(o.totalPaise)}</Text>,
  },
  {
    id: 'payment',
    title: 'Payment',
    render: (o) => (
      <Badge tone={o.status === 'placed' && o.paymentMethod === 'cod' ? 'attention' : 'success'}>
        {o.paymentMethod === 'cod' ? (o.status === 'placed' ? 'COD pending' : 'COD') : 'Paid'}
      </Badge>
    ),
  },
  {
    id: 'status',
    title: 'Status',
    render: (o) => <Badge tone={tone[o.status]}>{cap(o.status)}</Badge>,
  },
]

function OrdersContent() {
  const router = useRouter()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(STATUS),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.orders
      .list({
        page: q.page,
        perPage: PER_PAGE,
        search: q.query || undefined,
        status: q.status ?? undefined,
      })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q.page, q.query, q.status])

  return (
    <Page title="Orders" secondaryActions={[{ content: 'Export', disabled: true }]}>
      <ResourceTable
        resourceName={{ singular: 'order', plural: 'orders' }}
        columns={columns}
        items={items}
        getId={(o) => o.id}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        filters={[
          {
            key: 'status',
            label: 'Status',
            filter: (
              <ChoiceList
                title="Status"
                titleHidden
                choices={STATUS.map((s) => ({ label: cap(s), value: s }))}
                selected={q.status ? [q.status] : []}
                onChange={(v) =>
                  setQ({ status: (v[0] as (typeof STATUS)[number]) ?? null, page: 1 })
                }
              />
            ),
            appliedLabel: q.status ? `Status: ${q.status}` : null,
            onRemove: () => setQ({ status: null, page: 1 }),
          },
        ]}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        page={q.page}
        perPage={PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        empty={{
          heading: 'No orders yet',
          body: 'Orders appear here as soon as a customer checks out.',
        }}
      />
    </Page>
  )
}

export function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  )
}
