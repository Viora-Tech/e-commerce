import type { Metadata } from 'next'
import { abandonedContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { parseRowsPerPage } from '@/lib/rows-per-page'
import AbandonedPage from './abandoned-page'

export const metadata: Metadata = { title: abandonedContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, [])
  const perPage = parseRowsPerPage(params.perPage)
  const context = await serverContext()
  const [result, stats] = await Promise.all([
    call(appRouter.orders.listAbandoned, { page: query.page, perPage, sinceDays: 30 }, { context }),
    call(appRouter.orders.abandonedStats, undefined, { context }),
  ])
  return <AbandonedPage initial={{ page: query.page, perPage, result, stats }} />
}
