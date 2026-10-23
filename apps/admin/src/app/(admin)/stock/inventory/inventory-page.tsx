'use client'

import { siteConfig } from '@commerce/config/site'
import { STOCK_FILTERS, type StockFilter } from '@commerce/core/catalog'
import { permissions } from '@commerce/core/permissions'
import { Clock, Download, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import { downloadInventoryCsv } from '@/components/inventory/export-inventory'
import HistoryDialog from '@/components/inventory/history-dialog'
import InventoryBulkActions from '@/components/inventory/inventory-bulk-actions'
import InventoryBulkDialog, { type BulkEdit } from '@/components/inventory/inventory-bulk-dialog'
import {
  type InventoryRow,
  inventoryColumns,
  rowName,
} from '@/components/inventory/inventory-columns'
import InventoryStrip from '@/components/inventory/inventory-strip'
import InventoryTiles, { type InventoryStats } from '@/components/inventory/inventory-tiles'
import type { StoreLocation } from '@/components/inventory/location-select'
import ProoflyListPage from '@/components/layout/proofly-list-page'
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
import { inventoryContent, locationsContent, type ManualReasonValue } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import type { ListQuery } from '@/lib/list-query'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.inventory.list>>
type Facets = Awaited<ReturnType<typeof api.inventory.facets>>

/** First page rendered on the server so the table never paints empty. */
export type InventoryInitial = {
  query: ListQuery<never>
  locationId: string
  locations: StoreLocation[]
  result: ListResult
  stats: InventoryStats
  facets: Facets
}

type Query = {
  page: number
  perPage: number
  query: string
  stock: StockFilter | null
  vendor: string | null
  productType: string | null
}

const PER_PAGE = siteConfig.ui.rowsPerPage.default

function listFilters(locationId: string, q: Query) {
  return {
    locationId,
    search: q.query || undefined,
    stock: q.stock ?? undefined,
    vendor: q.vendor ?? undefined,
    productType: q.productType ?? undefined,
  }
}

/** One page of rows plus the tiles for the same location. */
function fetchPage(locationId: string, q: Query) {
  return Promise.all([
    api.inventory.list({ ...listFilters(locationId, q), page: q.page, perPage: q.perPage }),
    api.inventory.stats({ locationId }),
  ])
}

function emptyState(copy: typeof inventoryContent) {
  return {
    heading: copy.empty.heading,
    body: copy.empty.body,
    action: (
      <Button render={<Link href={routes.products.new()} />} nativeButton={false}>
        <Plus />
        {copy.empty.action}
      </Button>
    ),
  }
}

function untouched(initial: InventoryInitial, locationId: string, q: Query) {
  return (
    locationId === initial.locationId &&
    q.page === initial.query.page &&
    q.perPage === PER_PAGE &&
    q.query === initial.query.query &&
    !q.stock &&
    !q.vendor &&
    !q.productType
  )
}

function InventoryContent({ initial }: { initial: InventoryInitial }) {
  // Hooks
  const copy = useCopy(inventoryContent)
  const panelCopy = useCopy(filterPanelContent)
  const { hasPermission } = usePermissions()
  const [q, setQ] = useQueryStates(
    {
      location: parseAsString,
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(PER_PAGE),
      stock: parseAsStringLiteral(STOCK_FILTERS),
      vendor: parseAsString,
      productType: parseAsString,
    },
    { shallow: true },
  )
  const [locations, setLocations] = useState(initial.locations)
  const [rows, setRows] = useState(initial.result.rows)
  const [total, setTotal] = useState(initial.result.total)
  const [stats, setStats] = useState(initial.stats)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<ManualReasonValue>('correction')
  const [bulk, setBulk] = useState<{ mode: 'adjust' | 'set'; ids: string[]; clear: () => void }>()
  const [history, setHistory] = useState<InventoryRow | null>(null)
  const [addingLocation, setAddingLocation] = useState(false)

  useEffect(() => {
    const locationId = q.location ?? initial.locationId
    if (untouched(initial, locationId, q)) return
    let cancelled = false
    setLoading(true)
    fetchPage(locationId, q)
      .then(([list, s]) => {
        if (cancelled) return
        setRows(list.rows)
        setTotal(list.total)
        setStats(s)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial])

  // Helpers
  const currentLocation = () => q.location ?? initial.locationId

  const refresh = async () => {
    const [list, s] = await fetchPage(currentLocation(), q)
    setRows(list.rows)
    setTotal(list.total)
    setStats(s)
  }

  const commitRow = async (row: InventoryRow, delta: number): Promise<boolean> => {
    try {
      const onHand = await api.inventory.edit({
        variantId: row.variantId,
        locationId: currentLocation(),
        mode: 'adjust',
        value: delta,
        reason,
      })
      toast.success(copy.cell.saved(rowName(row), onHand - row.committed))
      await refresh()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.cell.failed)
      return false
    }
  }

  // Event handlers
  const handleBulk = async (edit: BulkEdit) => {
    if (!bulk) return
    setBusy(true)
    try {
      const { updated } = await api.inventory.bulkEdit({
        ...edit,
        locationId: currentLocation(),
        variantIds: bulk.ids,
      })
      toast.success(copy.bulk.done(updated))
      bulk.clear()
      setBulk(undefined)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    setBusy(true)
    try {
      const locationId = currentLocation()
      const all = await api.inventory.exportRows(listFilters(locationId, q))
      if (all.length === 0) {
        toast.error(copy.exporting.empty)
        return
      }
      downloadInventoryCsv(all, locations.find((l) => l.id === locationId)?.name ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.exporting.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleLocationCreated = (created: StoreLocation) => {
    setLocations([...locations, created])
    setQ({ location: created.id, page: 1 })
  }

  // Render logic
  const locationId = currentLocation()
  const canEdit = hasPermission(permissions.INVENTORY_WRITE)
  const groups: FilterGroup[] = [
    {
      key: 'stock',
      label: copy.filters.stock,
      type: 'select',
      options: copy.filters.stockOptions,
      value: q.stock,
      onChange: (next) => setQ({ stock: STOCK_FILTERS.find((s) => s === next) ?? null, page: 1 }),
      anyLabel: copy.filters.any,
    },
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
      options: facetOptions(initial.facets.types),
      value: q.productType,
      onChange: (productType) => setQ({ productType, page: 1 }),
      anyLabel: copy.filters.any,
    },
  ]
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query !== ''

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary(stats.skus, stats.outOfStock)}
      actions={
        <>
          <Button variant="outline" onClick={handleExport} disabled={busy}>
            <Download strokeWidth={1.6} />
            {copy.export}
          </Button>
          {canEdit ? (
            <Button onClick={() => setAddingLocation(true)}>
              <Plus strokeWidth={1.6} />
              {locationsContent.add}
            </Button>
          ) : null}
        </>
      }
      stats={<InventoryTiles stats={stats} />}
      controls={
        <InventoryStrip
          locations={locations}
          locationId={locationId}
          onLocationChange={(location) => setQ({ location, page: 1 })}
          reason={canEdit ? reason : null}
          onReasonChange={setReason}
        />
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={inventoryColumns({
          copy,
          canEdit,
          lowAt: stats.lowThreshold,
          onCommit: commitRow,
        })}
        items={rows}
        getId={(r) => r.variantId}
        rowActions={(r) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.cell.history}
            title={copy.cell.history}
            onClick={(e) => {
              e.stopPropagation()
              setHistory(r)
            }}
          >
            <Clock aria-hidden="true" />
          </Button>
        )}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() =>
          setQ({ query: '', stock: null, vendor: null, productType: null, page: 1 })
        }
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(total), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={applied}
        views={
          <ViewSelect
            value={q.stock === 'out' || q.stock === 'low' ? q.stock : null}
            onChange={(stock) => setQ({ stock, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: stats.skus },
              { value: 'out', label: copy.tabs.out, count: stats.outOfStock },
              { value: 'low', label: copy.tabs.low, count: stats.lowStock },
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        total={total}
        onPageChange={(page) => setQ({ page })}
        selectable={canEdit}
        bulkActions={(ids, clear) => (
          <InventoryBulkActions busy={busy} onPick={(mode) => setBulk({ mode, ids, clear })} />
        )}
        empty={filtered ? { heading: copy.noMatch } : emptyState(copy)}
      />

      <InventoryBulkDialog
        mode={bulk?.mode ?? null}
        count={bulk?.ids.length ?? 0}
        busy={busy}
        onOpenChange={(open) => !open && setBulk(undefined)}
        onApply={handleBulk}
      />
      <HistoryDialog
        variantId={history?.variantId ?? null}
        name={history ? rowName(history) : ''}
        sku={history?.sku ?? null}
        locationId={locationId}
        onClose={() => setHistory(null)}
      />
      <AddLocationDialog
        open={addingLocation}
        onOpenChange={setAddingLocation}
        onCreated={handleLocationCreated}
      />
    </ProoflyListPage>
  )
}

export default function InventoryPage({ initial }: { initial: InventoryInitial }) {
  return (
    <Suspense>
      <InventoryContent initial={initial} />
    </Suspense>
  )
}
