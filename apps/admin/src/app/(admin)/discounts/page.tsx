import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { DISCOUNT_LIFECYCLES } from '@/data/discounts'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import DiscountsPage from './discounts-page'

export const metadata: Metadata = { title: 'Discounts' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, DISCOUNT_LIFECYCLES)
  const context = await serverContext()
  const [result, stats, all] = await Promise.all([
    call(
      appRouter.discounts.list,
      {
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
        lifecycle: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.discounts.stats, undefined, { context }),
    call(appRouter.discounts.list, { page: 1, perPage: 1 }, { context }),
  ])

  return <DiscountsPage initial={{ query, result, stats, allCount: all.total }} />
}
