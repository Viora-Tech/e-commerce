'use client'

import { Plus, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import KitListPage from '@/components/kit/kit-list-page'
import PillTabs from '@/components/layout/pill-tabs'
import { purchaseOrderColumns } from '@/components/purchase-orders/purchase-order-columns'
import PurchaseOrderTiles, {
  type PurchaseOrderCounts,
} from '@/components/purchase-orders/purchase-order-tiles'
import ResourceTable from '@/components/table/resource-table'
import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatus,
  purchaseOrdersContent,
} from '@/data/inventory'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'

type ListResult = Awaited<ReturnType<typeof api.purchaseOrders.list>>

/** First page rendered on the server so the table never paints empty. */
export type PurchaseOrdersInitial = {
  query: ListQuery<PurchaseOrderStatus>
  result: ListResult
  counts: PurchaseOrderCounts
}

const PER_PAGE = LIST_PER_PAGE
const NEW_HREF = '/products/purchase-orders/new'
const copy = purchaseOrdersContent

function allCount(c: PurchaseOrderCounts): number {
  return c.draft + c.open + c.received + c.closed
}

function PurchaseOrdersContent({ initial }: { initial: PurchaseOrdersInitial }) {
  // Hooks
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(PURCHASE_ORDER_STATUSES),
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.result.rows)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery(q, initial.query)) return
    let cancelled = false
    setLoading(true)
    api.purchaseOrders
      .list({
        page: q.page,
        perPage: PER_PAGE,
        search: q.query || undefined,
        status: q.status ?? undefined,
      })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query])

  // Render logic
  return (
    <KitListPage
      title={copy.heading}
      actions={
        <Button size="lg" render={<Link href={NEW_HREF} />} nativeButton={false}>
          <SquarePlus strokeWidth={1.6} />
          {copy.create}
        </Button>
      }
      strip={<PurchaseOrderTiles counts={initial.counts} />}
    >
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={purchaseOrderColumns}
        items={rows}
        getId={(r) => r.id}
        href={(r) => `/products/purchase-orders/${r.id}`}
        loading={loading}
        selectable={false}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: allCount(initial.counts) },
              ...PURCHASE_ORDER_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
            ]}
          />
        }
        page={q.page}
        perPage={PER_PAGE}
        total={total}
        onPageChange={(page) => setQ({ page })}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
              <Plus />
              {copy.create}
            </Button>
          ),
        }}
      />
    </KitListPage>
  )
}

export default function PurchaseOrdersPage({ initial }: { initial: PurchaseOrdersInitial }) {
  return (
    <Suspense>
      <PurchaseOrdersContent initial={initial} />
    </Suspense>
  )
}
