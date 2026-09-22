'use client'

import { LayoutGrid, MoreHorizontal, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import CollectionCards from '@/components/collections/collection-cards'
import { collectionProductColumns } from '@/components/collections/collection-columns'
import CollectionTiles from '@/components/collections/collection-tiles'
import DeleteProductDialog from '@/components/collections/delete-product-dialog'
import KitListPage from '@/components/kit/kit-list-page'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable, { type AppliedFilter } from '@/components/table/resource-table'
import { collectionsListContent as copy } from '@/data/collections'
import { api } from '@/lib/api-client'

type ProductsResult = Awaited<ReturnType<typeof api.collections.products>>
type Collections = Awaited<ReturnType<typeof api.collections.list>>
type Stats = Awaited<ReturnType<typeof api.collections.stats>>
type Product = ProductsResult['items'][number]

export type CollectionsInitial = {
  collections: Collections
  stats: Stats
  products: ProductsResult
}

/** Frame 5:4205: ten rows per page under the category cards. */
const PER_PAGE = 10
const TABS = ['featured', 'onSale', 'outOfStock'] as const

function CollectionsContent({ initial }: { initial: CollectionsInitial }) {
  // Hooks
  const [q, setQ] = useQueryStates(
    {
      collection: parseAsString,
      query: parseAsString.withDefault(''),
      tab: parseAsStringLiteral(TABS),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.products)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)

  useEffect(() => {
    const untouched = !q.collection && q.query === '' && !q.tab && q.page === 1
    if (untouched) {
      setResult(initial.products)
      return
    }
    let cancelled = false
    setLoading(true)
    api.collections
      .products({
        collectionId: q.collection ?? undefined,
        search: q.query || undefined,
        tab: q.tab ?? undefined,
        page: q.page,
        perPage: PER_PAGE,
      })
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.products])

  // Helpers
  const refresh = async () => {
    const r = await api.collections.products({
      collectionId: q.collection ?? undefined,
      search: q.query || undefined,
      tab: q.tab ?? undefined,
      page: q.page,
      perPage: PER_PAGE,
    })
    setResult(r)
  }

  // Event handlers
  const handleConfirmDelete = async () => {
    const target = deleting
    if (!target) return
    setDeleting(null)
    try {
      await api.products.delete({ id: target.id })
      toast.success(copy.rowActions.remove)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.rowActions.remove)
    }
  }

  // Render logic
  const selected = initial.collections.find((c) => c.id === q.collection) ?? null
  const applied: AppliedFilter[] = selected
    ? [
        {
          key: 'collection',
          label: copy.filteredBy(selected.title),
          onRemove: () => setQ({ collection: null, page: 1 }),
        },
      ]
    : []

  return (
    <KitListPage
      title={copy.heading}
      actions={
        <>
          <Button size="lg" render={<Link href="/products/new" />} nativeButton={false}>
            <SquarePlus strokeWidth={1.6} />
            {copy.add}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="lg">
                  {copy.moreActions}
                  <MoreHorizontal strokeWidth={1.6} />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href="/products/collections/new" />}>
                {copy.newCollection}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/products" />}>
                {copy.allProducts}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      strip={
        <>
          <CollectionTiles stats={initial.stats} />
          {initial.collections.length === 0 ? (
            <Card className="mt-6">
              <EmptyState
                icon={LayoutGrid}
                heading={copy.noCollections.heading}
                body={copy.noCollections.body}
                action={
                  <Button render={<Link href="/products/collections/new" />} nativeButton={false}>
                    {copy.noCollections.action}
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="mt-6">
              <CollectionCards
                collections={initial.collections}
                selectedId={q.collection}
                onSelect={(collection) => setQ({ collection, page: 1 })}
              />
            </div>
          )}
        </>
      }
    >
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={collectionProductColumns<Product>((p) => setDeleting(p))}
        items={result.items}
        getId={(p) => p.id}
        href={(p) => `/products/${p.id}`}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', tab: null, collection: null, page: 1 })}
        applied={applied}
        selectable={false}
        tabs={
          <PillTabs
            size="frame"
            value={q.tab}
            onChange={(tab) => setQ({ tab, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: initial.products.total },
              { value: 'featured', label: copy.tabs.featured },
              { value: 'onSale', label: copy.tabs.onSale },
              { value: 'outOfStock', label: copy.tabs.outOfStock },
            ]}
          />
        }
        page={q.page}
        perPage={PER_PAGE}
        total={result.total}
        onPageChange={(page) => setQ({ page })}
        empty={{ heading: copy.empty.heading, body: copy.empty.body }}
      />

      <DeleteProductDialog
        product={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </KitListPage>
  )
}

/** `useQueryStates` needs a Suspense boundary on a server-rendered page. */
export default function CollectionsPage({ initial }: { initial: CollectionsInitial }) {
  // Render logic
  return (
    <Suspense>
      <CollectionsContent initial={initial} />
    </Suspense>
  )
}
