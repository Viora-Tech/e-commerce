import type { Metadata } from 'next'
import { ORDER_STATUSES } from '@/data/orders'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import OrdersPage from './orders-page'

export const metadata: Metadata = { title: 'Orders' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, ORDER_STATUSES)
  const context = await serverContext()
  const [result, stats, all] = await Promise.all([
    call(
      appRouter.orders.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.orders.stats, undefined, { context }),
    call(appRouter.orders.list, { page: 1, perPage: 1 }, { context }),
  ])

  return <OrdersPage initial={{ query, result, stats, allCount: all.total }} />
}
