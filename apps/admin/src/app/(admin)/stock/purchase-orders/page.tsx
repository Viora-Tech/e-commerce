import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { PURCHASE_ORDER_STATUSES } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import PurchaseOrdersPage from './purchase-orders-page'

export const metadata: Metadata = { title: 'Purchase orders' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, PURCHASE_ORDER_STATUSES)
  const context = await serverContext()
  const [result, counts] = await Promise.all([
    call(
      appRouter.purchaseOrders.list,
      {
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.purchaseOrders.counts, undefined, { context }),
  ])

  return <PurchaseOrdersPage initial={{ query, result, counts }} />
}
