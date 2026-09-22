'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
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
import { type CustomerRow, customerColumns } from '@/components/customers/customer-columns'
import CustomerFilters, {
  type CustomerFilterState,
  EMPTY_CUSTOMER_FILTERS,
} from '@/components/customers/customer-filters'
import CustomerTiles, { type CustomerStats } from '@/components/customers/customer-tiles'
import TagCustomersDialog from '@/components/customers/tag-customers-dialog'
import PageBody from '@/components/layout/page-body'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable, { type AppliedFilter } from '@/components/table/resource-table'
import { CUSTOMER_SEGMENTS, type CustomerSegment, customersContent } from '@/data/customers'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import {
  appliedCustomerFilters,
  customerFilterInput,
  hasCustomerFilters,
  segmentRulesFromFilters,
} from './customer-filter-state'

type ListResult = Awaited<ReturnType<typeof api.customers.list>>

/** First page, tiles and the all-customers count rendered on the server so nothing paints empty. */
export type CustomersInitial = {
  query: ListQuery<CustomerSegment>
  result: ListResult
  stats: CustomerStats
  allCount: number
  tags: string[]
}

const PER_PAGE = LIST_PER_PAGE
const copy = customersContent

function exportRows(rows: CustomerRow[]): void {
  const csv = toCsv(
    ['Name', 'Email', 'Phone', 'City', 'State', 'Orders', 'Spent', 'Tags', 'Marketing'],
    rows.map((r) => [
      r.name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.city ?? '',
      r.stateCode ?? '',
      r.orderCount,
      formatPaise(r.spentPaise),
      r.tags.join(' '),
      r.acceptsMarketing ? 'yes' : 'no',
    ]),
  )
  downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  toast.success(copy.exported(rows.length))
}

function CustomersContent({ initial }: { initial: CustomersInitial }) {
  // Hooks
  const [{ page, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(CUSTOMER_SEGMENTS),
    },
    { shallow: true },
  )
  const [filters, setFilters] = useState<CustomerFilterState>(EMPTY_CUSTOMER_FILTERS)
  const [items, setItems] = useState<CustomerRow[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [tagAction, setTagAction] = useState<'add' | 'remove' | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const untouched =
      sameListQuery({ page, query, status }, initial.query) &&
      !hasCustomerFilters(filters) &&
      reloadKey === 0
    if (untouched) return
    let cancelled = false
    setLoading(true)
    api.customers
      .list({
        page,
        perPage: PER_PAGE,
        search: query || undefined,
        segment: status ?? undefined,
        ...customerFilterInput(filters),
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
  }, [page, query, status, filters, initial.query, reloadKey])

  // Helpers
  const patchFilters = (patch: Partial<CustomerFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setQ({ page: 1 })
  }

  const clearFilter = (key: keyof CustomerFilterState) => {
    patchFilters({ [key]: '' } as Partial<CustomerFilterState>)
  }

  // Event handlers
  const handleClearAll = () => {
    setFilters(EMPTY_CUSTOMER_FILTERS)
    setQ({ query: '', status: null, page: 1 })
  }

  const handleExportAll = async () => {
    try {
      const rows = await api.customers.export({
        search: query || undefined,
        segment: status ?? undefined,
        ...customerFilterInput(filters),
      })
      exportRows(rows)
    } catch {
      toast.error(copy.exportFailed)
    }
  }

  const handleBulkTag = (ids: string[], action: 'add' | 'remove') => {
    setTagIds(ids)
    setTagAction(action)
  }

  // Render logic
  const applied = appliedCustomerFilters(filters, clearFilter) satisfies AppliedFilter[]
  const segmentHref = `/customers/segments/new?rules=${encodeURIComponent(
    JSON.stringify(segmentRulesFromFilters(filters, status)),
  )}`

  return (
    <PageBody className="gap-6">
      <div className="flex h-9 items-center justify-between gap-3">
        <h1 className="text-page-title">{copy.heading}</h1>
        <div className="flex items-center gap-2">
          {applied.length > 0 ? (
            <Button variant="outline" size="sm" render={<Link href={segmentHref} />}>
              {copy.saveSegment}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleExportAll}>
            {copy.exportAll}
          </Button>
        </div>
      </div>
      <CustomerTiles stats={initial.stats} />
      <div className="-mt-1">
        <ResourceTable
          resourceName={copy.resource}
          columns={customerColumns}
          items={items}
          getId={(c) => c.id}
          href={(c) => `/customers/${c.id}`}
          loading={loading}
          query={query}
          onQueryChange={(q) => setQ({ query: q, page: 1 })}
          onClearAll={handleClearAll}
          filters={<CustomerFilters value={filters} tags={initial.tags} onChange={patchFilters} />}
          applied={applied}
          tabs={
            <PillTabs
              value={status}
              onChange={(s) => setQ({ status: s, page: 1 })}
              tabs={[
                { value: null, label: copy.tabs.all, count: initial.allCount },
                ...CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: copy.tabs[s] })),
              ]}
            />
          }
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={(p) => setQ({ page: p })}
          bulkActions={(ids, clear) => (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                {copy.bulk.addTag}
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleBulkTag(ids, 'add')}>
                  {copy.bulk.addTag}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkTag(ids, 'remove')}>
                  {copy.bulk.removeTag}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    exportRows(items.filter((i) => ids.includes(i.id)))
                    clear()
                  }}
                >
                  {copy.bulk.export}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          empty={copy.empty}
        />
      </div>
      <TagCustomersDialog
        ids={tagIds}
        action={tagAction}
        onClose={() => setTagAction(null)}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </PageBody>
  )
}

export default function CustomersPage({ initial }: { initial: CustomersInitial }) {
  return (
    <Suspense>
      <CustomersContent initial={initial} />
    </Suspense>
  )
}
