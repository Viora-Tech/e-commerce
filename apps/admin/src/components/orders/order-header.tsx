'use client'

import { ShoppingBag } from '@commerce/ui/icons'
import { type ReactNode, useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import { orderDetailContent, ordersContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import OrderChip from './order-chip'
import { methodLabel, type OrderDetail } from './order-detail-types'

export type Neighbours = Awaited<ReturnType<typeof api.orders.neighbours>>

type OrderHeaderProps = {
  order: OrderDetail
  /** The header actions, given the previous and next orders once they load. */
  actions: (neighbours: Neighbours | null) => ReactNode
}

/**
 * The order page header (Figma "Orders / Order detail"): a back link, the order glyph, "Order #n"
 * with its status chips, a plain-words line under it, and Print and the ⋯ menu on the right.
 */
export default function OrderHeader({ order, actions }: OrderHeaderProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const listCopy = useCopy(ordersContent)
  const fmt = useFormat()
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null)

  useEffect(() => {
    let live = true
    api.orders.neighbours({ id: order.id }).then((n) => {
      if (live) setNeighbours(n)
    })
    return () => {
      live = false
    }
  }, [order.id])

  // Render logic
  /* Open is the everyday state; only a closed order earns its own lifecycle chip. */
  const closed = order.status !== 'open'
  /* Figma: a paid order nobody has shipped yet reads "To ship" (blue), as in the list. */
  const toShip =
    !closed && order.fulfillmentStatus === 'unfulfilled' && order.paymentStatus === 'paid'

  return (
    <div className="print:hidden">
      <PageHeader
        title={copy.title(order.number)}
        size="sm"
        back={{ label: copy.back, href: routes.orders.list() }}
        lead={{ kind: 'tile', node: <ShoppingBag /> }}
        badges={
          <>
            {closed ? <OrderChip kind="order" value={order.status} /> : null}
            <OrderChip kind="orderPayment" value={order.paymentStatus} />
            {toShip ? (
              <StatusChip tone="info">{listCopy.toShip}</StatusChip>
            ) : (
              <OrderChip kind="fulfilment" value={order.fulfillmentStatus} />
            )}
          </>
        }
        summary={
          <>
            <span title={fmt.dateTime(order.placedAt)}>{copy.placed(fmt.ago(order.placedAt))}</span>
            {order.paymentMethod ? (
              <>
                {' · '}
                {copy.paidVia}: {methodLabel(order.paymentMethod, copy)}
              </>
            ) : null}
          </>
        }
        actions={actions(neighbours)}
      />
    </div>
  )
}
