'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
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
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.purchaseOrders.list>>

/** First page rendered on the server so the table never paints empty. */
export type PurchaseOrdersInitial = {
  query: ListQuery<PurchaseOrderStatus>
  result: ListResult
  counts: PurchaseOrderCounts
}

const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NEW_HREF = routes.stock.newPurchaseOrder()

function allCount(c: PurchaseOrderCounts): number {
  return c.draft + c.open + c.received + c.closed + c.cancelled
}

function PurchaseOrdersContent({ initial }: { initial: PurchaseOrdersInitial }) {
  // Hooks
  const copy = useCopy(purchaseOrdersContent)
  usePrimaryAction(NEW_HREF)
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(PER_PAGE),
      status: parseAsStringLiteral(PURCHASE_ORDER_STATUSES),
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.result.rows)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery(q, initial.query) && q.perPage === PER_PAGE) return
    let cancelled = false
    setLoading(true)
    api.purchaseOrders
      .list({
        page: q.page,
        perPage: q.perPage,
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
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary}
      actions={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
                <SquarePlus strokeWidth={1.6} />
                {copy.create}
              </Button>
            }
          />
          <TooltipContent>
            {copy.create} <Kbd>N</Kbd>
          </TooltipContent>
        </Tooltip>
      }
      stats={<PurchaseOrderTiles counts={initial.counts} />}
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={purchaseOrderColumns(copy)}
        items={rows}
        getId={(r) => r.id}
        href={(r) => routes.stock.purchaseOrder(r.id)}
        loading={loading}
        selectable={false}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs
            variant="segmented"
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: allCount(initial.counts) },
              ...PURCHASE_ORDER_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
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
    </ProoflyListPage>
  )
}

export default function PurchaseOrdersPage({ initial }: { initial: PurchaseOrdersInitial }) {
  return (
    <Suspense>
      <PurchaseOrdersContent initial={initial} />
    </Suspense>
  )
}
