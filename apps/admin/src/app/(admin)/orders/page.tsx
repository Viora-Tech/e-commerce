import type { Metadata } from 'next'
import { ORDER_LIST_FILTERS } from '@/data/orders'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import { orderListFilter } from '@/lib/order-filter'
import OrdersPage from './orders-page'

export const metadata: Metadata = { title: 'Orders' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, ORDER_LIST_FILTERS)
  const context = await serverContext()
  const [result, all, pending] = await Promise.all([
    call(
      appRouter.orders.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        ...orderListFilter(query.status),
      },
      { context },
    ),
    call(appRouter.orders.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.orders.list, { page: 1, perPage: 1, pendingUpi: true }, { context }),
  ])

  return (
    <OrdersPage initial={{ query, result, allCount: all.total, pendingUpiCount: pending.total }} />
  )
}
