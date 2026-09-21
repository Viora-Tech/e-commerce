'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Button } from '@commerce/ui/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageBody } from '@/components/layout/page-body'
import { ProductStatusBadge, ProductThumb } from '@/components/products/product-badges'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { PRODUCT_STATUSES, productsListContent } from '@/data/products'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'

type ListResult = Awaited<ReturnType<typeof api.products.list>>
type Item = ListResult['items'][number]

/** First page rendered on the server so the table never paints empty. */
export type ProductsInitial = { query: ListQuery<ProductStatus>; result: ListResult }

const PER_PAGE = LIST_PER_PAGE
const ALL = 'all'
const copy = productsListContent
const TAB =
  'h-8 rounded-full px-4 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none'

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
    render: (p) => (
      <span className="flex items-center gap-3">
        <ProductThumb url={p.imageUrl} />
        <span className="font-bold text-ink-strong">{p.title}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (p) => p.status,
    render: (p) => <ProductStatusBadge status={p.status} />,
  },
  {
    id: 'inventory',
    title: copy.columns.inventory,
    sortValue: (p) => p.available,
    render: (p) => (
      <span className={p.available === 0 ? 'text-destructive' : 'text-muted-foreground'}>
        {copy.inventory(p.available, p.variantCount)}
      </span>
    ),
  },
  {
    id: 'type',
    title: copy.columns.type,
    sortValue: (p) => p.productType ?? '',
    render: (p) => <span className="text-muted-foreground">{p.productType ?? copy.none}</span>,
  },
  {
    id: 'vendor',
    title: copy.columns.vendor,
    sortValue: (p) => p.vendor ?? '',
    render: (p) => <span className="text-muted-foreground">{p.vendor ?? copy.none}</span>,
  },
  {
    id: 'price',
    title: copy.columns.price,
    sortValue: (p) => p.minPricePaise ?? 0,
    align: 'end',
    render: (p) => (
      <span className="font-bold text-ink-strong tabular-nums">
        {p.minPricePaise != null ? formatPaise(p.minPricePaise) : copy.none}
      </span>
    ),
  },
]

function ProductsContent({ initial }: { initial: ProductsInitial }) {
  const [q, setQ] = useQueryStates(
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

  const { page, query, status } = q

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

  async function bulkSetStatus(ids: string[], next: ProductStatus, clear: () => void) {
    try {
      await Promise.all(ids.map((id) => api.products.update({ id, status: next })))
      toast.success(copy.bulk.updated(ids.length))
      clear()
      const r = await fetchProducts(q)
      setItems(r.items)
      setTotal(r.total)
    } catch {
      toast.error(copy.bulk.failed)
    }
  }

  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={q.status ?? ALL}
          onValueChange={(v) => setQ({ status: v === ALL ? null : (v as ProductStatus), page: 1 })}
        >
          <TabsList className="h-10 rounded-full bg-card p-1 shadow-card">
            <TabsTrigger value={ALL} className={TAB}>
              {copy.tabs.all}
            </TabsTrigger>
            {PRODUCT_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className={TAB}>
                {copy.status[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/products/new" />} nativeButton={false} className="h-10 px-4">
            <Plus />
            {copy.add}
          </Button>
        </div>
      </div>
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(p) => p.id}
        href={(p) => `/products/${p.id}`}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        page={q.page}
        perPage={PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <>
            <Button variant="outline" size="sm" onClick={() => bulkSetStatus(ids, 'active', clear)}>
              {copy.bulk.setActive}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkSetStatus(ids, 'archived', clear)}
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

export function ProductsPage({ initial }: { initial: ProductsInitial }) {
  return (
    <Suspense>
      <ProductsContent initial={initial} />
    </Suspense>
  )
}
