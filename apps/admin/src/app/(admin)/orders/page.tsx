import type { Metadata } from 'next'
import { ORDER_LIST_FILTERS } from '@/data/orders'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { orderListFilter } from '@/lib/order-filter'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import OrdersPage from './orders-page'

export const metadata: Metadata = { title: 'Orders' }

type Context = Awaited<ReturnType<typeof serverContext>>

/** Total orders in one tab, for the tab badges and the summary line. */
function count(context: Context, view?: (typeof ORDER_LIST_FILTERS)[number]) {
  return call(
    appRouter.orders.list,
    { page: 1, perPage: 1, ...(view ? { view } : {}) },
    { context },
  )
}

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, ORDER_LIST_FILTERS)
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, all, unpaid, unfulfilled, pending, tiles, appActions] = await Promise.all([
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
    count(context),
    count(context, 'unpaid'),
    count(context, 'unfulfilled'),
    count(context, 'pending_upi'),
    call(appRouter.orders.tiles, undefined, { context }),
    call(appRouter.apps.orderActions, undefined, { context }).catch(() => []),
  ])

  return (
    <OrdersPage
      initial={{
        query,
        perPage,
        result,
        tiles,
        appActions,
        counts: {
          all: all.total,
          unpaid: unpaid.total,
          unfulfilled: unfulfilled.total,
          pendingUpi: pending.total,
        },
      }}
    />
  )
}
