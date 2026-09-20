'use client'

/** Products list: URL-driven search, filters and paging over the store-scoped API. */
import GlobalLayout from '@commerce/ui/global/global-layout'
import { GlobalPagination } from '@commerce/ui/global/global-pagination'
import IconComponent from '@commerce/ui/global/icon-component'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Suspense, useState } from 'react'
import { type AdminFilterNode, AdminFilterPopover } from '@/components/global/admin-filter-popover'
import { AdminSearchInput } from '@/components/global/admin-search-input'
import { useEntityList } from '@/hooks/use-entity-list'
import { api } from '@/lib/api-client'
import { extractEnumFilter } from '@/lib/extract-filter-value'
import { PRODUCT_FILTER_FIELDS } from './product-filters'
import { ProductsTable } from './products-table'
import type { ProductListItem } from './types'
import { useProductQueryState } from './use-product-query-state'

function ProductsListContent() {
  const [queryState, setQueryState] = useProductQueryState()
  const { search, page, limit, status } = queryState
  const [appliedFilters, setAppliedFilters] = useState<AdminFilterNode[]>([])
  const hasActiveFilters = appliedFilters.length > 0

  const list = useEntityList<ProductListItem>({
    deps: [page, limit, search, status],
    fetchPage: () =>
      api.products.list({
        page,
        perPage: limit,
        search: search || undefined,
        status: status ?? undefined,
      }),
  })
  const totalPages = Math.max(1, Math.ceil(list.totalCount / limit))

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-y-4 pb-6">
      <GlobalLayout title="Products" description="Everything this store sells.">
        <div className="flex w-full items-center gap-4">
          <AdminSearchInput
            value={search}
            placeholder="Search by title"
            onDebouncedChange={(value) => setQueryState({ search: value, page: 1 })}
          />
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <AdminFilterPopover
              appliedNodes={appliedFilters}
              fields={PRODUCT_FILTER_FIELDS}
              onAppliedNodesChange={(nodes) => {
                setAppliedFilters(nodes)
                const s = extractEnumFilter<'draft' | 'active' | 'archived'>(nodes, 'status')
                setQueryState({ status: s ?? null, page: 1 })
              }}
              trigger={
                <Button
                  aria-label="Filter"
                  size="icon"
                  variant="outline"
                  className={cn(
                    'size-10 rounded-xl',
                    hasActiveFilters
                      ? 'bg-secondary hover:bg-secondary'
                      : 'bg-transparent! hover:bg-secondary/40',
                  )}
                >
                  <IconComponent className="size-5 text-muted-foreground" icon="ArrowUpDown" />
                </Button>
              }
            />
            <Button className="h-10 gap-2 rounded-xl px-4" disabled>
              <IconComponent className="size-4" icon="Plus" />
              New product
            </Button>
          </div>
        </div>

        <ProductsTable
          products={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          selectedIds={list.selectedIds}
          onSelectionChange={list.setSelectedIds}
        />

        <GlobalPagination
          currentPage={page}
          itemsPerPage={limit}
          totalItems={list.totalCount}
          totalPages={totalPages}
          onPageChange={(p) => setQueryState({ page: p })}
          onPrevious={() => setQueryState({ page: Math.max(1, page - 1) })}
          onNext={() => setQueryState({ page: Math.min(totalPages, page + 1) })}
          onPageSizeChange={(size) => setQueryState({ limit: size, page: 1 })}
        />
      </GlobalLayout>
    </div>
  )
}

export function ProductsListPage() {
  return (
    <Suspense>
      <ProductsListContent />
    </Suspense>
  )
}
