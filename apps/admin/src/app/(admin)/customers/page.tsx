import type { Metadata } from 'next'
import { CUSTOMER_SEGMENTS } from '@/data/customers'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import CustomersPage from './customers-page'

export const metadata: Metadata = { title: 'Customers' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, CUSTOMER_SEGMENTS)
  const context = await serverContext()
  const [result, stats, tags] = await Promise.all([
    call(
      appRouter.customers.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        segment: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.customers.stats, undefined, { context }),
    call(appRouter.customers.tags, undefined, { context }),
  ])

  return <CustomersPage initial={{ query, result, stats, allCount: stats.total, tags }} />
}
