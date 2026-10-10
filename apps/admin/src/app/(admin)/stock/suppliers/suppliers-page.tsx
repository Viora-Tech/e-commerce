'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import { supplierColumns } from '@/components/suppliers/supplier-columns'
import ResourceTable from '@/components/table/resource-table'
import { suppliersContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { ListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type SuppliersResult = Awaited<ReturnType<typeof api.suppliers.list>>

/** First page rendered on the server so the table never paints empty. */
export type SuppliersInitial = { query: ListQuery<never>; result: SuppliersResult }

const ROWS = siteConfig.ui.rowsPerPage.default
const ADD_HREF = routes.stock.newSupplier()

function SuppliersContent({ initial }: { initial: SuppliersInitial }) {
  // Hooks
  const copy = useCopy(suppliersContent)
  usePrimaryAction(ADD_HREF)
  const [state, setState] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(ROWS),
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.result)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unchanged =
      state.page === initial.query.page &&
      state.query === initial.query.query &&
      state.perPage === ROWS
    if (unchanged) return
    let stale = false
    setLoading(true)
    api.suppliers
      .list({ page: state.page, perPage: state.perPage, search: state.query || undefined })
      .then((next) => !stale && setResult(next))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [state, initial.query])

  // Render logic
  const addButton = (
    <Button render={<Link href={ADD_HREF} />} nativeButton={false}>
      <Plus />
      {copy.create}
    </Button>
  )

  return (
    <ProoflyListPage title={copy.heading} summary={copy.summary} actions={addButton}>
      <ResourceTable
        resourceName={copy.resource}
        columns={supplierColumns(copy)}
        items={result.rows}
        getId={(r) => r.id}
        href={(r) => routes.stock.supplier(r.id)}
        loading={loading}
        selectable={false}
        query={state.query}
        onQueryChange={(query) => setState({ query, page: 1 })}
        onClearAll={() => setState({ query: '', page: 1 })}
        page={state.page}
        perPage={state.perPage}
        onPerPageChange={(perPage) => setState({ perPage, page: 1 })}
        total={result.total}
        onPageChange={(page) => setState({ page })}
        empty={{ heading: copy.empty.heading, body: copy.empty.body, action: addButton }}
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
