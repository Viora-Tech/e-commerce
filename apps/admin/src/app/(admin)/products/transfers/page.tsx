import type { Metadata } from 'next'
import { TRANSFER_STATUSES } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import TransfersPage from './transfers-page'

export const metadata: Metadata = { title: 'Transfers' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, TRANSFER_STATUSES)
  const context = await serverContext()
  const [result, all, locations] = await Promise.all([
    call(
      appRouter.transfers.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.transfers.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.inventory.locations, undefined, { context }),
  ])

  return <TransfersPage initial={{ query, result, allCount: all.total, locations }} />
}
