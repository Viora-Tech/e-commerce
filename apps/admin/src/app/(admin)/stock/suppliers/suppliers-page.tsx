'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import SupplierBulkActions from '@/components/suppliers/supplier-bulk-actions'
import { supplierColumns } from '@/components/suppliers/supplier-columns'
import DeleteRowMenu from '@/components/table/delete-row-menu'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import { filterPanelContent } from '@/data/filter-panel'
import { supplierFormContent, suppliersContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { ListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import {
  CLEAR_SUPPLIER_FILTERS,
  hasSupplierFilters,
  SUPPLIER_FILTER_PARAMS,
  type SupplierFilters,
  supplierFilterGroups,
  supplierFilterInput,
} from '@/lib/supplier-list-filters'

type SuppliersResult = Awaited<ReturnType<typeof api.suppliers.list>>

/** First page rendered on the server so the table never paints empty. */
export type SuppliersInitial = {
  query: ListQuery<never>
  result: SuppliersResult
  /** Countries and currencies in use, for the filter pickers. */
  facets: { countries: string[]; currencies: string[] }
}

type Query = SupplierFilters & { page: number; perPage: number; query: string }

function listInput(q: Query) {
  return {
    page: q.page,
    perPage: q.perPage,
    search: q.query || undefined,
    ...supplierFilterInput(q),
  }
}

const ROWS = siteConfig.ui.rowsPerPage.default
const ADD_HREF = routes.stock.newSupplier()

function SuppliersContent({ initial }: { initial: SuppliersInitial }) {
  // Hooks
  const copy = useCopy(suppliersContent)
  const form = useCopy(supplierFormContent)
  const panelCopy = useCopy(filterPanelContent)
  usePrimaryAction(ADD_HREF)
  const [state, setState] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(ROWS),
      ...SUPPLIER_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.result)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const unchanged =
      state.page === initial.query.page &&
      state.query === initial.query.query &&
      state.perPage === ROWS &&
      !hasSupplierFilters(state)
    if (unchanged) return
    let stale = false
    setLoading(true)
    setFailed(false)
    api.suppliers
      .list(listInput(state))
      .then((next) => !stale && setResult(next))
      .catch(() => !stale && setFailed(true))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [state, initial.query])

  // Helpers
  const refresh = async () => {
    setResult(await api.suppliers.list(listInput(state)))
  }

  // Event handlers
  /* Try again on a failed read: the rows are read again in place, under the same header. */
  const handleRetry = () => {
    setFailed(false)
    setLoading(true)
    refresh()
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }
  const handleChanged = () => {
    refresh().catch(() => setFailed(true))
  }

  // Render logic
  const groups = supplierFilterGroups(state, copy.filters, initial.facets, (patch) =>
    setState({ ...patch, page: 1 }),
  )
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || state.query.length > 0
  const addButton = (
    <Button render={<Link href={ADD_HREF} />} nativeButton={false}>
      <Plus />
      {copy.create}
    </Button>
  )

  return (
    <ProoflyListPage title={copy.heading} summary={copy.summary} actions={addButton}>
      <ResourceTable
        fill
        resourceName={copy.resource}
        columns={supplierColumns(copy)}
        items={result.rows}
        getId={(r) => r.id}
        href={(r) => routes.stock.supplier(r.id)}
        rowActions={(r) => (
          <DeleteRowMenu
            label={form.delete}
            confirm={form.confirmDelete}
            deleted={form.deleted}
            failed={form.deleteFailed}
            onDelete={() => api.suppliers.delete({ id: r.id })}
            onChanged={handleChanged}
          />
        )}
        loading={loading}
        error={failed ? { onRetry: handleRetry } : undefined}
        bulkActions={(ids, clear) => (
          <SupplierBulkActions
            ids={ids}
            onDone={() => {
              clear()
              handleChanged()
            }}
          />
        )}
        query={state.query}
        onQueryChange={(query) => setState({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setState({ ...CLEAR_SUPPLIER_FILTERS, query: '', page: 1 })}
        filterGroups={groups}
        page={state.page}
        perPage={state.perPage}
        onPerPageChange={(perPage) => setState({ perPage, page: 1 })}
        total={result.total}
        onPageChange={(page) => setState({ page })}
        empty={
          filtered
            ? copy.noResults
            : { heading: copy.empty.heading, body: copy.empty.body, action: addButton }
        }
      />
    </ProoflyListPage>
  )
}

export default function SuppliersPage({ initial }: { initial: SuppliersInitial }) {
  return (
    <Suspense>
      <SuppliersContent initial={initial} />
    </Suspense>
  )
}
