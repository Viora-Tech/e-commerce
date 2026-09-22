import type { Metadata } from 'next'
import { draftsContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import DraftsPage from './drafts-page'

export const metadata: Metadata = { title: draftsContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, [])
  const context = await serverContext()
  const result = await call(
    appRouter.orders.listDrafts,
    { page: query.page, perPage: LIST_PER_PAGE, search: query.query || undefined },
    { context },
  )
  return <DraftsPage initial={{ query, result }} />
}
