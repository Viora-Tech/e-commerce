'use client'

import { siteConfig } from '@commerce/config/site'
import { type ProductStatus, STOCK_FILTERS } from '@commerce/core/catalog'
import { Download, Plus, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import BulkTagDialog from '@/components/products/bulk-tag-dialog'
import BulkWriteBanner from '@/components/products/bulk-write/bulk-write-banner'
import BulkWriteSheet from '@/components/products/bulk-write/bulk-write-sheet'
import { downloadProductCsv } from '@/components/products/export-products'
import ImportDialog from '@/components/products/import-dialog'
import ProductBulkActions from '@/components/products/product-bulk-actions'
import { productColumns } from '@/components/products/product-columns'
import ProductRowMenu from '@/components/products/product-row-menu'
import ProductTiles from '@/components/products/product-tiles'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  type FilterGroup,
  FilterPanel,
  facetOptions,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { PRODUCT_STATUSES, productsListContent, type StockFilter } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.products.list>>
type Facets = Awaited<ReturnType<typeof api.products.facets>>
type Stats = Awaited<ReturnType<typeof api.products.stats>>
type BulkAction = Parameters<typeof api.products.bulk>[0]['action']
type BulkResult = Awaited<ReturnType<typeof api.products.bulk>>

/** First page rendered on the server so the table never paints empty. */
export type ProductsInitial = {
  query: ListQuery<ProductStatus>
  result: ListResult
  stats: Stats
  facets: Facets
  /** Bulk "Write with AI" is on for this store and member. */
  aiBulk: boolean
  /** The store's public origin, for the row menu's "View on store". */
  storefrontOrigin: string
}

type Query = {
  page: number
  perPage: number
  query: string
  status: ProductStatus | null
  vendor: string | null
  productType: string | null
  tag: string | null
  stock: StockFilter | null
}

const DEFAULT_PER_PAGE = siteConfig.ui.rowsPerPage.default

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
  const copy = useCopy(productsListContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  usePrimaryAction(routes.products.new())
  const router = useRouter()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PER_PAGE),
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
  const [writing, setWriting] = useState<{ ids: string[] | null; jobId: string | null } | null>(
    null,
  )
  const [aiRefresh, setAiRefresh] = useState(0)

  const hydrated = useRef(false)

  useEffect(() => {
    const sameQuery = sameListQuery(
      { page: q.page, query: q.query, status: q.status },
      initial.query,
    )
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (firstRun && sameQuery && !hasFilters(q) && q.perPage === DEFAULT_PER_PAGE) return
    let cancelled = false
    setLoading(true)
    api.products
      .list({ page: q.page, perPage: q.perPage, ...listInput(q) })
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
    const r = await api.products.list({ page: q.page, perPage: q.perPage, ...listInput(q) })
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
  const { stats } = initial
  const statusCounts = {
    active: stats.active,
    draft: stats.draft,
    archived: Math.max(0, stats.total - stats.active - stats.draft),
  }
  const groups: FilterGroup[] = [
    {
      key: 'vendor',
      label: copy.filters.vendor,
      type: 'select',
      options: facetOptions(initial.facets.vendors),
      value: q.vendor,
      onChange: (vendor) => setQ({ vendor, page: 1 }),
      anyLabel: copy.filters.any,
    },
    {
      key: 'type',
      label: copy.filters.productType,
      type: 'select',
      options: facetOptions(initial.facets.productTypes),
      value: q.productType,
      onChange: (productType) => setQ({ productType, page: 1 }),
      anyLabel: copy.filters.any,
    },
    {
      key: 'tag',
      label: copy.filters.tag,
      type: 'select',
      options: facetOptions(initial.facets.tags),
      value: q.tag,
      onChange: (tag) => setQ({ tag, page: 1 }),
      anyLabel: copy.filters.any,
    },
    {
      key: 'stock',
      label: copy.filters.stock,
      type: 'select',
      options: copy.filters.stockOptions,
      value: q.stock,
      onChange: (next) => setQ({ stock: STOCK_FILTERS.find((s) => s === next) ?? null, page: 1 }),
      anyLabel: copy.filters.any,
    },
  ]

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(stats.total, stats.lowStock, stats.outOfStock)}
      stats={
        <ProductTiles
          stats={stats}
          stock={q.stock}
          status={q.status}
          onSelect={(patch) =>
            setQ({
              stock: null,
              status: null,
              vendor: null,
              productType: null,
              tag: null,
              ...patch,
              page: 1,
            })
          }
        />
      }
      actions={
        <>
          <Button variant="outline" onClick={() => setImporting(true)} disabled={busy}>
            <Upload strokeWidth={1.6} />
            {copy.import}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={busy}>
            <Download strokeWidth={1.6} />
            {copy.export}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button render={<Link href={routes.products.new()} />} nativeButton={false}>
                  <Plus strokeWidth={1.6} />
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
      {initial.aiBulk ? (
        <BulkWriteBanner
          refreshKey={aiRefresh}
          onOpen={(jobId) => setWriting({ ids: null, jobId })}
        />
      ) : null}
      <ResourceTable
        resourceName={copy.resource}
        columns={productColumns(copy, fmt, initial.facets.lowStockThreshold)}
        items={items}
        getId={(p) => p.id}
        href={(p) => routes.products.detail(p.id)}
        rowActions={(p) => (
          <ProductRowMenu
            product={p}
            storefrontOrigin={initial.storefrontOrigin}
            onChanged={() => void refresh()}
          />
        )}
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
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(total), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={appliedFromGroups(groups, panelCopy)}
        views={
          <ViewSelect
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: stats.total },
              ...PRODUCT_STATUSES.map((s) => ({
                value: s,
                label: copy.status[s],
                count: statusCounts[s],
              })),
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        total={total}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <ProductBulkActions
            ids={ids}
            busy={busy}
            onStatus={(status) =>
              runBulk(ids, { kind: 'status', status }, clear, (r) => copy.bulk.updated(r.changed))
            }
            onTag={() => setTagging({ ids, clear })}
            onBulkEdit={() => router.push(routes.products.bulkEdit(ids))}
            onDelete={() => setDeleting({ ids, clear })}
            onWriteAi={initial.aiBulk ? () => setWriting({ ids, jobId: null }) : undefined}
            onDone={() => {
              clear()
              void refresh()
            }}
          />
        )}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button render={<Link href={routes.products.new()} />} nativeButton={false}>
              <Plus />
              {copy.add}
            </Button>
          ),
        }}
      />

      <ImportDialog open={importing} onOpenChange={setImporting} onImported={refresh} />
      {initial.aiBulk ? (
        <BulkWriteSheet
          open={writing !== null}
          onOpenChange={(open) => {
            if (open) return
            setWriting(null)
            setAiRefresh((n) => n + 1)
          }}
          productIds={writing?.ids ?? null}
          jobId={writing?.jobId ?? null}
          onApplied={() => void refresh()}
        />
      ) : null}
      <BulkTagDialog
        open={tagging !== null}
        onOpenChange={(open) => !open && setTagging(null)}
        onApply={handleApplyTag}
        count={tagging?.ids.length ?? 0}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={copy.bulk.confirmDelete.title(deleting?.ids.length ?? 0)}
        body={copy.bulk.confirmDelete.body}
        confirmLabel={copy.bulk.confirmDelete.confirm}
        cancelLabel={copy.bulk.confirmDelete.cancel}
        busy={busy}
        onConfirm={handleConfirmDelete}
      />
    </ProoflyListPage>
  )
}

export default function ProductsPage({ initial }: { initial: ProductsInitial }) {
  return (
    <Suspense>
      <ProductsContent initial={initial} />
    </Suspense>
  )
}
