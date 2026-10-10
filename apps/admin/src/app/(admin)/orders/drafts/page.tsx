import type { Metadata } from 'next'
import { DRAFT_LIST_FILTERS, draftsContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import DraftsPage from './drafts-page'

export const metadata: Metadata = { title: draftsContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, DRAFT_LIST_FILTERS)
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, tiles] = await Promise.all([
    call(
      appRouter.orders.listDrafts,
      {
        page: query.page,
        perPage,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.orders.draftTiles, undefined, { context }),
  ])
  return <DraftsPage initial={{ query, perPage, result, tiles }} />
}
