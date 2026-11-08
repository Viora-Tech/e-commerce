import type { Metadata } from 'next'
import { ORDER_LIST_FILTERS } from '@/data/orders'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { orderListFilter } from '@/lib/order-filter'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import { listApps } from '@/lib/shell-data'
import OrdersPage from './orders-page'

export const metadata: Metadata = { title: 'Orders' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, ORDER_LIST_FILTERS)
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, counts, tiles, appActions, apps] = await Promise.all([
    call(
      appRouter.orders.list,
      {
        page: query.page,
        perPage,
        search: query.query || undefined,
        ...orderListFilter(query.status),
      },
      { context },
    ),
    // Every tab badge in one query, not a full list read per tab.
    call(appRouter.orders.tabCounts, undefined, { context }),
    call(appRouter.orders.tiles, undefined, { context }),
    call(appRouter.apps.orderActions, undefined, { context }).catch(() => []),
    listApps().catch(() => []),
  ])

  return (
    <OrdersPage
      initial={{
        query,
        perPage,
        result,
        tiles,
        appActions,
        automations: apps.some((a) => a.installed && a.id === 'automations'),
        counts,
      }}
    />
  )
}
