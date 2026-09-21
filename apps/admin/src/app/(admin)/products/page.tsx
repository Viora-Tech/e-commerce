import type { Metadata } from 'next'
import { PRODUCT_STATUSES } from '@/data/products'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import { ProductsPage } from './products-page'

export const metadata: Metadata = { title: 'Products' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, PRODUCT_STATUSES)
  const context = await serverContext()
  const [result, all] = await Promise.all([
    call(
      appRouter.products.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.products.list, { page: 1, perPage: 1 }, { context }),
  ])
  return <ProductsPage initial={{ query, result, allCount: all.total }} />
}
