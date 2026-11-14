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
  // Rows, tab badges, stat cards and the apps' order actions in one call and one transaction.
  const [{ result, counts, tiles, appActions }, apps] = await Promise.all([
    call(
      appRouter.orders.listPage,
      {
        page: query.page,
        perPage,
        search: query.query || undefined,
        ...orderListFilter(query.status),
      },
      { context },
    ),
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
