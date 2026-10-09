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
import CustomerRowActions from '@/components/customers/customer-row-actions'
import CustomerTiles, { type CustomerStats } from '@/components/customers/customer-tiles'
import TagCustomersDialog from '@/components/customers/tag-customers-dialog'
import PageBody from '@/components/layout/page-body'
import PillTabs from '@/components/layout/pill-tabs'
import PageState from '@/components/states/page-state'
import ResourceTable, { type AppliedFilter } from '@/components/table/resource-table'
import { CUSTOMER_SEGMENTS, type CustomerSegment, customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import {
  appliedCustomerFilters,
  customerFilterInput,
  hasCustomerFilters,
  segmentRulesFromFilters,
} from './customer-filter-state'

type ListResult = Awaited<ReturnType<typeof api.customers.list>>

/** First page, stat cards and the all-customers count from the server so nothing paints empty. */
export type CustomersInitial = {
  query: ListQuery<CustomerSegment>
  perPage: number
  result: ListResult
  stats: CustomerStats
  allCount: number
  tags: string[]
}

function exportRows(rows: CustomerRow[], exported: (n: number) => string): void {
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
  toast.success(exported(rows.length))
}

/** One mailto with the selected customers in Bcc, so the addresses stay private from each other. */
function bulkMailto(rows: CustomerRow[]): string | null {
  const emails = rows.flatMap((r) => (r.email ? [r.email] : []))
  return emails.length > 0 ? `mailto:?bcc=${encodeURIComponent(emails.join(','))}` : null
}

function CustomersContent({ initial }: { initial: CustomersInitial }) {
  // Hooks
  const copy = useCopy(customersContent)
  const [{ page, perPage, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(initial.perPage),
      status: parseAsStringLiteral(CUSTOMER_SEGMENTS),
    },
    { shallow: true },
  )
  const [filters, setFilters] = useState<CustomerFilterState>(EMPTY_CUSTOMER_FILTERS)
  const [items, setItems] = useState<CustomerRow[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tagAction, setTagAction] = useState<'add' | 'remove' | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const untouched =
      sameListQuery({ page, query, status }, initial.query) &&
      perPage === initial.perPage &&
      !hasCustomerFilters(filters) &&
      reloadKey === 0
    if (untouched) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    api.customers
      .list({
        page,
        perPage,
        search: query || undefined,
        segment: status ?? undefined,
        ...customerFilterInput(filters),
      })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, perPage, query, status, filters, initial.query, initial.perPage, reloadKey])

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
      exportRows(rows, copy.exported)
    } catch {
      toast.error(copy.exportFailed)
    }
  }

  const handleBulkTag = (ids: string[], action: 'add' | 'remove') => {
    setTagIds(ids)
    setTagAction(action)
  }

  const handleReload = () => setReloadKey((k) => k + 1)

  // Render logic
  const columns = customerColumns(copy)
  const applied = appliedCustomerFilters(filters, clearFilter) satisfies AppliedFilter[]
  const filtered = applied.length > 0 || query.length > 0
  const segmentHref = `${routes.customers.newSegment()}?rules=${encodeURIComponent(
    JSON.stringify(segmentRulesFromFilters(filters, status)),
  )}`
  const summary =
    initial.stats.total === 0
      ? copy.summary.empty
      : [
          copy.summary.total(initial.stats.total),
          copy.summary.newThisWeek(initial.stats.newLast7),
          copy.summary.repeat(initial.stats.returning),
        ].join(' · ')

  return (
    <PageBody width="frame" className="max-w-[77.5rem] gap-6 md:mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title text-ink-strong">{copy.heading}</h1>
          <p className="text-body text-muted-foreground">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {applied.length > 0 ? (
            <Button variant="outline" render={<Link href={segmentHref} />} nativeButton={false}>
              {copy.saveSegment}
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleExportAll}>
            {copy.exportAll}
          </Button>
          <Button
            variant="key-neutral"
            render={<Link href={routes.customers.segments()} />}
            nativeButton={false}
          >
            {copy.segmentsLink}
          </Button>
        </div>
      </div>
      <CustomerTiles
        stats={initial.stats}
        active={status}
        onSelect={(s) => setQ({ status: s, page: 1 })}
      />
      {failed ? (
        <PageState
          kind="error"
          heading={copy.loadFailed.heading}
          body={copy.loadFailed.body}
          onRetry={handleReload}
        />
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={columns}
          items={items}
          getId={(c) => c.id}
          href={(c) => routes.customers.detail(c.id)}
          rowActions={(c) => (
            <CustomerRowActions
              id={c.id}
              name={c.name ?? c.email ?? copy.unnamed}
              email={c.email}
              phone={c.phone}
              onDeleted={handleReload}
            />
          )}
          loading={loading}
          query={query}
          onQueryChange={(q) => setQ({ query: q, page: 1 })}
          onClearAll={handleClearAll}
          filters={<CustomerFilters value={filters} tags={initial.tags} onChange={patchFilters} />}
          applied={applied}
          tabs={
            <PillTabs
              variant="segmented"
              value={status}
              onChange={(s) => setQ({ status: s, page: 1 })}
              tabs={[
                { value: null, label: copy.tabs.all, count: initial.allCount },
                ...CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: copy.tabs[s] })),
              ]}
            />
          }
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={(p) => setQ({ page: p })}
          onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
          bulkActions={(ids, clear) => {
            const mail = bulkMailto(items.filter((i) => ids.includes(i.id)))
            return (
              <>
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
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportRows(
                      items.filter((i) => ids.includes(i.id)),
                      copy.exported,
                    )
                    clear()
                  }}
                >
                  {copy.bulk.export}
                </Button>
                {mail ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={mail} />}
                    nativeButton={false}
                  >
                    {copy.bulk.email}
                  </Button>
                ) : null}
              </>
            )
          }}
          empty={filtered ? copy.noResults : copy.empty}
        />
      )}
      <TagCustomersDialog
        ids={tagIds}
        action={tagAction}
        onClose={() => setTagAction(null)}
        onDone={handleReload}
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
