import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { INBOUND_SHIPMENT_STATUSES, inboundShipmentsContent } from '@/data/purchasing'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import InboundShipmentsPage from './inbound-shipments-page'

export const metadata: Metadata = { title: inboundShipmentsContent.heading }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, INBOUND_SHIPMENT_STATUSES)
  const context = await serverContext()
  const [result, all] = await Promise.all([
    call(
      appRouter.inboundShipments.list,
      {
        page: query.page,
        perPage: siteConfig.ui.rowsPerPage.default,
        search: query.query || undefined,
        status: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.inboundShipments.list, { page: 1, perPage: 1 }, { context }),
  ])

  return <InboundShipmentsPage initial={{ query, result, allCount: all.total }} />
}
