import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { CUSTOMER_SEGMENTS } from '@/data/customers'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import { listApps } from '@/lib/shell-data'
import CustomersPage from './customers-page'

export const metadata: Metadata = { title: 'Customers' }

type Props = { searchParams: Promise<SearchParams> }

/** Rows per page from `?perPage=`, limited to the sizes the table offers. */
function parsePerPage(raw: string | string[] | undefined): number {
  const value = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? '', 10)
  const options: readonly number[] = siteConfig.ui.rowsPerPage.options
  return options.includes(value) ? value : siteConfig.ui.rowsPerPage.default
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = parseListQuery(params, CUSTOMER_SEGMENTS)
  const perPage = parsePerPage(params.perPage)
  const context = await serverContext()
  const [result, stats, tags, apps] = await Promise.all([
    call(
      appRouter.customers.list,
      {
        page: query.page,
        perPage,
        search: query.query || undefined,
        segment: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.customers.stats, undefined, { context }),
    call(appRouter.customers.tags, undefined, { context }),
    listApps().catch(() => []),
  ])

  const automations = apps.some((a) => a.installed && a.id === 'automations')
  return (
    <CustomersPage
      initial={{ query, perPage, result, stats, allCount: stats.total, tags, automations }}
    />
  )
}
