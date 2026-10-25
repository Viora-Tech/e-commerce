import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import PackingSlipsView from '@/components/orders/packing-slips-view'
import { packingSlipsContent } from '@/data/orders-bulk'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: packingSlipsContent.title }

type Props = { searchParams: Promise<{ ids?: string }> }

/** The list prints at most this many at once; anything past it in the URL is ignored. */
const PRINT_MAX = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Orders → selected → Print packing slips: every slip on its own page, then the print dialog. */
export default async function PackingSlipsPage({ searchParams }: Props) {
  const { ids = '' } = await searchParams
  const wanted = [...new Set(ids.split(',').filter((id) => UUID.test(id)))].slice(0, PRINT_MAX)
  const context = await serverContext()
  const found = await Promise.all(
    wanted.map((id) => call(appRouter.orders.get, { id }, { context }).catch(orNoStore(undefined))),
  )
  if (found.includes(undefined)) redirect(routes.selectStore())
  const orders = found.filter((o): o is OrderDetail => Boolean(o))
  return <PackingSlipsView orders={orders} failed={orders.length < wanted.length} />
}
