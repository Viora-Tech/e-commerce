'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Plus, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PillTabs from '@/components/layout/pill-tabs'
import ProductThumb from '@/components/products/product-thumb'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { PRODUCT_STATUSES, productsListContent } from '@/data/products'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.products.list>>
type Item = ListResult['items'][number]

/** First page rendered on the server so the table never paints empty. */
export type ProductsInitial = {
  query: ListQuery<ProductStatus>
  result: ListResult
  allCount: number
}

const PER_PAGE = LIST_PER_PAGE
const copy = productsListContent

type Query = ListQuery<ProductStatus>

function fetchProducts(q: Query) {
  return api.products.list({
    page: q.page,
    perPage: PER_PAGE,
    search: q.query || undefined,
    status: q.status ?? undefined,
  })
}

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'product',
    title: copy.columns.product,
    sortValue: (p) => p.title,
    hideable: false,
    align: 'start',
    className: 'w-80 px-3 whitespace-normal',
    render: (p) => (
      <span className="flex items-center gap-3 text-left">
        <ProductThumb url={p.imageUrl} />
        <span className="line-clamp-2 text-body-strong">{p.title}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (p) => p.status,
    render: (p) => <StatusLabel kind="product" value={p.status} variant="pill" />,
  },
  {
    id: 'inventory',
    title: copy.columns.inventory,
    sortValue: (p) => p.available,
    render: (p) => (
      <span className={p.available === 0 ? 'text-destructive' : undefined}>
        {copy.inventory(p.available, p.variantCount)}
      </span>
    ),
  },
  {
    id: 'type',
    title: copy.columns.type,
    sortValue: (p) => p.productType ?? '',
    render: (p) => p.productType ?? copy.none,
  },
  {
    id: 'vendor',
    title: copy.columns.vendor,
    sortValue: (p) => p.vendor ?? '',
    render: (p) => p.vendor ?? copy.none,
  },
  {
    id: 'price',
    title: copy.columns.price,
    sortValue: (p) => p.minPricePaise ?? 0,
    render: (p) => (
      <span className="tabular-nums">
        {p.minPricePaise != null ? formatPaise(p.minPricePaise) : copy.none}
      </span>
    ),
  },
]

function ProductsContent({ initial }: { initial: ProductsInitial }) {
  // Hooks
  const [{ page, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(PRODUCT_STATUSES),
    },
    { shallow: true },
  )

  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery({ page, query, status }, initial.query)) return
    let cancelled = false
    setLoading(true)
    fetchProducts({ page, query, status })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, initial.query])

  // Event handlers
  const handleBulkSetStatus = async (ids: string[], next: ProductStatus, clear: () => void) => {
    try {
      await Promise.all(ids.map((id) => api.products.update({ id, status: next })))
      toast.success(copy.bulk.updated(ids.length))
      clear()
      const r = await fetchProducts({ page, query, status })
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  return (
    <PageBody className="gap-6">
      {/* 5:2375 + 5:2503: heading left, the 48px primary action right. */}
      <div className="flex h-9 items-center justify-between">
        <h1 className="text-page-title">{copy.heading}</h1>
        <Button size="lg" render={<Link href="/products/new" />} nativeButton={false}>
          <SquarePlus strokeWidth={1.6} />
          {copy.add}
        </Button>
      </div>
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(p) => p.id}
        href={(p) => `/products/${p.id}`}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: initial.allCount },
              ...PRODUCT_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
            ]}
          />
        }
        page={page}
        perPage={PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkSetStatus(ids, 'active', clear)}
            >
              {copy.bulk.setActive}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkSetStatus(ids, 'archived', clear)}
            >
              {copy.bulk.archive}
            </Button>
          </>
        )}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button render={<Link href="/products/new" />} nativeButton={false}>
              <Plus />
              {copy.add}
            </Button>
          ),
        }}
      />
    </PageBody>
  )
}

export default function ProductsPage({ initial }: { initial: ProductsInitial }) {
  return (
    <Suspense>
      <ProductsContent initial={initial} />
    </Suspense>
  )
}
