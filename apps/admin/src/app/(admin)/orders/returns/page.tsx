import type { Metadata } from 'next'
import { returnsContent } from '@/data/returns'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { RETURN_LIST_FILTERS, returnListFilter } from '@/lib/return-filter'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import ReturnsPage from './returns-page'

export const metadata: Metadata = { title: returnsContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, RETURN_LIST_FILTERS)
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, counts] = await Promise.all([
    call(
      appRouter.returns.list,
      {
        page: query.page,
        perPage,
        search: query.query || undefined,
        ...returnListFilter(query.status),
      },
      { context },
    ),
    call(appRouter.returns.counts, undefined, { context }),
  ])
  return <ReturnsPage initial={{ query, perPage, result, counts }} />
}
