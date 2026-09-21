'use client'

import { Badge, ChoiceList, InlineStack, Page, Text, Thumbnail } from '@shopify/polaris'
import { ImageIcon } from '@shopify/polaris-icons'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { ResourceTable, type ResourceTableColumn } from '@/components/polaris/resource-table'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Item = Awaited<ReturnType<typeof api.products.list>>['items'][number]

const STATUS = ['draft', 'active', 'archived'] as const
const PER_PAGE = 25

const tone: Record<Item['status'], 'success' | 'info' | undefined> = {
  active: 'success',
  draft: 'info',
  archived: undefined,
}

const columns: ResourceTableColumn<Item>[] = [
  {
    id: 'product',
    title: 'Product',
    render: (p) => (
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <Thumbnail source={p.imageUrl ?? ImageIcon} alt="" size="small" />
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {p.title}
        </Text>
      </InlineStack>
    ),
  },
  {
    id: 'status',
    title: 'Status',
    render: (p) => (
      <Badge tone={tone[p.status]}>{p.status[0]?.toUpperCase() + p.status.slice(1)}</Badge>
    ),
  },
  {
    id: 'inventory',
    title: 'Inventory',
    render: (p) => (
      <Text as="span" tone={p.available === 0 ? 'critical' : undefined}>
        {p.available} in stock for {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
      </Text>
    ),
  },
  { id: 'type', title: 'Type', render: (p) => <Text as="span">{p.productType ?? '—'}</Text> },
  { id: 'vendor', title: 'Vendor', render: (p) => <Text as="span">{p.vendor ?? '—'}</Text> },
  {
    id: 'price',
    title: 'Price',
    alignment: 'end',
    render: (p) => (
      <Text as="span">{p.minPricePaise != null ? formatPaise(p.minPricePaise) : '—'}</Text>
    ),
  },
]

function ProductsContent() {
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
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void refreshKey // re-run after bulk actions
    api.products
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
  }, [q.page, q.query, q.status, refreshKey])

  return (
    <Page
      title="Products"
      primaryAction={{ content: 'Add product', url: '/products/new' }}
      secondaryActions={[
        { content: 'Export', disabled: true },
        { content: 'Import', disabled: true },
      ]}
    >
      <ResourceTable
        resourceName={{ singular: 'product', plural: 'products' }}
        columns={columns}
        items={items}
        getId={(p) => p.id}
        onRowClick={(p) => router.push(`/products/${p.id}`)}
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
                choices={STATUS.map((s) => ({ label: s[0]?.toUpperCase() + s.slice(1), value: s }))}
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
        bulkActions={(ids, clear) => [
          {
            content: 'Set as active',
            onAction: async () => {
              await Promise.all(ids.map((id) => api.products.update({ id, status: 'active' })))
              clear()
              setRefreshKey((k) => k + 1)
            },
          },
          {
            content: 'Archive',
            onAction: async () => {
              await Promise.all(ids.map((id) => api.products.update({ id, status: 'archived' })))
              clear()
              setRefreshKey((k) => k + 1)
            },
          },
        ]}
      />
    </Page>
  )
}

export function ProductsPage() {
  return (
    <Suspense>
      <ProductsContent />
    </Suspense>
  )
}
