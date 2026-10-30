import { DOCUMENT_KINDS, type DocumentKind } from '@commerce/core/document-templates'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import PackingSlipsView from '@/components/orders/packing-slips-view'
import { packingSlipsContent } from '@/data/orders-bulk'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: packingSlipsContent.title }

type Props = { searchParams: Promise<{ ids?: string; doc?: string }> }

/** The list prints at most this many at once; anything past it in the URL is ignored. */
const PRINT_MAX = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const kindOf = (doc: string | undefined): DocumentKind =>
  DOCUMENT_KINDS.find((k) => k === doc) ?? 'packing_slip'

/**
 * Orders → selected → Print packing slips, pick list or invoices: the store's template
 * (Settings › Printed documents) filled from each order, then the print dialog.
 */
export default async function PackingSlipsPage({ searchParams }: Props) {
  const { ids = '', doc } = await searchParams
  const kind = kindOf(doc)
  const wanted = [...new Set(ids.split(',').filter((id) => UUID.test(id)))].slice(0, PRINT_MAX)
  const context = await serverContext()
  const [found, view] = await Promise.all([
    Promise.all(
      wanted.map((id) =>
        call(appRouter.orders.get, { id }, { context }).catch(orNoStore(undefined)),
      ),
    ),
    call(appRouter.documents.templates, undefined, { context }).catch(orNoStore(undefined)),
  ])
  if (found.includes(undefined) || !view) redirect(routes.selectStore())
  const orders = found.filter((o): o is OrderDetail => Boolean(o))
  const template = view.templates.find((t) => t.kind === kind)
  return (
    <PackingSlipsView
      kind={kind}
      orders={orders}
      html={template?.html ?? ''}
      store={view.store}
      gstApp={view.gstApp}
      failed={orders.length < wanted.length}
    />
  )
}
