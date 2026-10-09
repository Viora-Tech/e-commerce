import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { PRODUCT_STATUSES } from '@/data/products'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import ProductsPage from './products-page'

export const metadata: Metadata = { title: 'Products' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, PRODUCT_STATUSES)
  const context = await serverContext()
  const [result, stats, facets, ai] = await Promise.all([
    call(
      appRouter.products.list,
      {
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.products.stats, undefined, { context }),
    call(appRouter.products.facets, undefined, { context }),
    // AI is optional: any failure just hides bulk "Write with AI".
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ])

  return (
    <ProductsPage initial={{ query, result, stats, facets, aiBulk: ai?.bulkWriter ?? false }} />
  )
}
