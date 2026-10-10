import type { Metadata } from 'next'
import { ABANDONED_LIST_FILTERS, abandonedContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import AbandonedPage from './abandoned-page'

export const metadata: Metadata = { title: abandonedContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, ABANDONED_LIST_FILTERS)
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, stats, counts] = await Promise.all([
    call(
      appRouter.orders.listAbandoned,
      {
        page: query.page,
        perPage,
        sinceDays: 30,
        status: query.status ?? undefined,
        search: query.query || undefined,
      },
      { context },
    ),
    call(appRouter.orders.abandonedStats, undefined, { context }),
    call(appRouter.orders.abandonedStats, { days: 30 }, { context }),
  ])
  return <AbandonedPage initial={{ query, perPage, result, stats, counts }} />
}
