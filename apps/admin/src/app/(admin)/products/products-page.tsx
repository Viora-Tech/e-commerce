'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Download, ExternalLink, Plus, SquarePlus, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import KitListPage from '@/components/kit/kit-list-page'
import PillTabs from '@/components/layout/pill-tabs'
import BulkTagDialog from '@/components/products/bulk-tag-dialog'
import ConfirmBulkDelete from '@/components/products/confirm-bulk-delete'
import { downloadProductCsv } from '@/components/products/export-products'
import ImportDialog from '@/components/products/import-dialog'
import ProductBulkActions from '@/components/products/product-bulk-actions'
import { productColumns } from '@/components/products/product-columns'
import ProductFilters, { type StockFilter } from '@/components/products/product-filters'
import ResourceTable, { type AppliedFilter } from '@/components/table/resource-table'
import RowIconCells from '@/components/table/row-icon-cells'
import { PRODUCT_STATUSES, productsListContent } from '@/data/products'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'

type ListResult = Awaited<ReturnType<typeof api.products.list>>
type Facets = Awaited<ReturnType<typeof api.products.facets>>
type BulkAction = Parameters<typeof api.products.bulk>[0]['action']
type BulkResult = Awaited<ReturnType<typeof api.products.bulk>>

/** First page rendered on the server so the table never paints empty. */
export type ProductsInitial = {
  query: ListQuery<ProductStatus>
  result: ListResult
  allCount: number
  facets: Facets
}

type Query = {
  page: number
  query: string
  status: ProductStatus | null
  vendor: string | null
  productType: string | null
  tag: string | null
  stock: StockFilter | null
}

const PER_PAGE = LIST_PER_PAGE
const STOCK_FILTERS = ['in', 'out', 'low'] as const
const copy = productsListContent

function listInput(q: Query) {
  return {
    search: q.query || undefined,
    status: q.status ?? undefined,
    vendor: q.vendor ?? undefined,
    productType: q.productType ?? undefined,
    tag: q.tag ?? undefined,
    stock: q.stock ?? undefined,
  }
}

function hasFilters(q: Query) {
  return Boolean(q.vendor || q.productType || q.tag || q.stock)
}

function ProductsContent({ initial }: { initial: ProductsInitial }) {
  // Hooks
  usePrimaryAction('/products/new')
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(PRODUCT_STATUSES),
      vendor: parseAsString,
      productType: parseAsString,
      tag: parseAsString,
      stock: parseAsStringLiteral(STOCK_FILTERS),
    },
    { shallow: true },
  )
  const [items, setItems] = useState(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [tagging, setTagging] = useState<{ ids: string[]; clear: () => void } | null>(null)
  const [deleting, setDeleting] = useState<{ ids: string[]; clear: () => void } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sameQuery = sameListQuery(
      { page: q.page, query: q.query, status: q.status },
      initial.query,
    )
    if (sameQuery && !hasFilters(q)) return
    let cancelled = false
    setLoading(true)
    api.products
      .list({ page: q.page, perPage: PER_PAGE, ...listInput(q) })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query])

  // Helpers
  const refresh = async () => {
    const r = await api.products.list({ page: q.page, perPage: PER_PAGE, ...listInput(q) })
    setItems(r.items)
    setTotal(r.total)
  }

  const runBulk = async (
    ids: string[],
    action: BulkAction,
    clear: () => void,
    message: (result: BulkResult) => string,
  ) => {
    setBusy(true)
    try {
      const result = await api.products.bulk({ ids, action })
      toast.success(message(result))
      clear()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleExport = async () => {
    setBusy(true)
    try {
      const rows = await api.products.exportRows(listInput(q))
      if (rows.length === 0) {
        toast.error(copy.exporting.empty)
        return
      }
      downloadProductCsv(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.exporting.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleApplyTag = (tag: string) => {
    if (!tagging) return
    const { ids, clear } = tagging
    setTagging(null)
    void runBulk(ids, { kind: 'addTag', tag }, clear, (r) => copy.bulk.tagged(r.changed, tag))
  }

  const handleConfirmDelete = () => {
    if (!deleting) return
    const { ids, clear } = deleting
    setDeleting(null)
    void runBulk(ids, { kind: 'delete' }, clear, (r) => copy.bulk.removed(r.deleted, r.archived))
  }

  // Render logic
  const stockLabel = copy.filters.stockOptions.find((o) => o.value === q.stock)?.label ?? q.stock
  const applied = [
    q.vendor && {
      key: 'vendor',
      label: `${copy.filters.vendor}: ${q.vendor}`,
      onRemove: () => setQ({ vendor: null, page: 1 }),
    },
    q.productType && {
      key: 'type',
      label: `${copy.filters.productType}: ${q.productType}`,
      onRemove: () => setQ({ productType: null, page: 1 }),
    },
    q.tag && {
      key: 'tag',
      label: `${copy.filters.tag}: ${q.tag}`,
      onRemove: () => setQ({ tag: null, page: 1 }),
    },
    q.stock && {
      key: 'stock',
      label: `${copy.filters.stock}: ${stockLabel}`,
      onRemove: () => setQ({ stock: null, page: 1 }),
    },
  ].filter(Boolean) as AppliedFilter[]

  return (
    <KitListPage
      title={copy.heading}
      actions={
        <>
          <Button variant="outline" size="lg" onClick={handleExport} disabled={busy}>
            <Download strokeWidth={1.6} />
            {copy.export}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setImporting(true)} disabled={busy}>
            <Upload strokeWidth={1.6} />
            {copy.import}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button size="lg" render={<Link href="/products/new" />} nativeButton={false}>
                  <SquarePlus strokeWidth={1.6} />
                  {copy.add}
                </Button>
              }
            />
            <TooltipContent>
              {copy.add} <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={productColumns}
        items={items}
        getId={(p) => p.id}
        href={(p) => `/products/${p.id}`}
        rowIconCells={{
          count: 2,
          render: (p) => (
            <RowIconCells
              links={[
                {
                  label: copy.row.openNewTab,
                  icon: ExternalLink,
                  href: `/products/${p.id}`,
                  newTab: true,
                },
              ]}
              menu={[
                { label: copy.row.edit, href: `/products/${p.id}` },
                {
                  label: copy.row.inventory,
                  href: `/products/inventory?query=${encodeURIComponent(p.title)}`,
                },
              ]}
            />
          ),
        }}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() =>
          setQ({
            query: '',
            status: null,
            vendor: null,
            productType: null,
            tag: null,
            stock: null,
            page: 1,
          })
        }
        filters={
          <ProductFilters
            values={{ vendor: q.vendor, productType: q.productType, tag: q.tag, stock: q.stock }}
            facets={initial.facets}
            onChange={(patch) => setQ({ ...patch, page: 1 })}
            onClear={() =>
              setQ({ vendor: null, productType: null, tag: null, stock: null, page: 1 })
            }
          />
        }
        applied={applied}
        tabs={
          <PillTabs
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: initial.allCount },
              ...PRODUCT_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
            ]}
          />
        }
        page={q.page}
        perPage={PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <ProductBulkActions
            busy={busy}
            onStatus={(status) =>
              runBulk(ids, { kind: 'status', status }, clear, (r) => copy.bulk.updated(r.changed))
            }
            onTag={() => setTagging({ ids, clear })}
            onDelete={() => setDeleting({ ids, clear })}
          />
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

      <ImportDialog open={importing} onOpenChange={setImporting} onImported={refresh} />
      <BulkTagDialog
        open={tagging !== null}
        onOpenChange={(open) => !open && setTagging(null)}
        onApply={handleApplyTag}
      />
      <ConfirmBulkDelete
        count={deleting?.ids.length ?? 0}
        open={deleting !== null}
        busy={busy}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </KitListPage>
  )
}

export default function ProductsPage({ initial }: { initial: ProductsInitial }) {
  return (
    <Suspense>
      <ProductsContent initial={initial} />
    </Suspense>
  )
}
