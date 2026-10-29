import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { suppliersContent } from '@/data/purchasing'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import SuppliersPage from './suppliers-page'

export const metadata: Metadata = { title: suppliersContent.heading }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, [] as const)
  const context = await serverContext()
  const [result, facets] = await Promise.all([
    call(
      appRouter.suppliers.list,
      {
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
      },
      { context },
    ),
    call(appRouter.suppliers.facets, undefined, { context }),
  ])

  return <SuppliersPage initial={{ query, result, facets }} />
}
