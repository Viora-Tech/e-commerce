import type { Metadata } from 'next'
import { abandonedContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import AbandonedPage from './abandoned-page'

export const metadata: Metadata = { title: abandonedContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, [])
  const context = await serverContext()
  const [result, stats] = await Promise.all([
    call(
      appRouter.orders.listAbandoned,
      { page: query.page, perPage: LIST_PER_PAGE, sinceDays: 30 },
      { context },
    ),
    call(appRouter.orders.abandonedStats, undefined, { context }),
  ])
  return <AbandonedPage initial={{ page: query.page, result, stats }} />
}
