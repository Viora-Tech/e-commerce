import type { Metadata } from 'next'
import { returnsContent } from '@/data/returns'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import { RETURN_LIST_FILTERS, returnListFilter } from '@/lib/return-filter'
import ReturnsPage from './returns-page'

export const metadata: Metadata = { title: returnsContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, RETURN_LIST_FILTERS)
  const context = await serverContext()
  const [result, counts] = await Promise.all([
    call(
      appRouter.returns.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        ...returnListFilter(query.status),
      },
      { context },
    ),
    call(appRouter.returns.counts, undefined, { context }),
  ])
  return <ReturnsPage initial={{ query, result, counts }} />
}
