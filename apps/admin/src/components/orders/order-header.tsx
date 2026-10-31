'use client'

import { ShoppingBag } from '@commerce/ui/icons'
import { type ReactNode, useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { orderChannel } from '@/lib/order-channel'
import { shownPaymentStatus } from '@/lib/order-next-move'
import { routes } from '@/lib/routes'
import OrderChip from './order-chip'
import { methodLabel, type OrderDetail } from './order-detail-types'

export type Neighbours = Awaited<ReturnType<typeof api.orders.neighbours>>

type OrderHeaderProps = {
  order: OrderDetail
  /** The header actions, given the previous and next orders once they load. */
  actions: (neighbours: Neighbours | null) => ReactNode
  /** Where Back goes; the orders list unless the order was opened from somewhere else. */
  back?: { label: string; href: string } | undefined
}

/**
 * The order page header (Figma "Orders / Order detail"): a back link, the order glyph, "Order #n"
 * with its status chips, a plain-words line under it, and Print and the ⋯ menu on the right.
 */
export default function OrderHeader({ order, actions, back }: OrderHeaderProps) {
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
  const soldThrough = orderChannel(order.attribution)
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
        back={back ?? { label: copy.back, href: routes.orders.list() }}
        lead={{ kind: 'tile', node: <ShoppingBag /> }}
        badges={
          <>
            {closed ? <OrderChip kind="order" value={order.status} /> : null}
            <OrderChip kind="orderPayment" value={shownPaymentStatus(order)} />
            {/* "Unfulfilled" on a cancelled order is noise: nothing will be shipped (audit #22). */}
            {toShip ? (
              <StatusChip tone="info">{listCopy.toShip}</StatusChip>
            ) : order.status === 'cancelled' && order.fulfillmentStatus === 'unfulfilled' ? null : (
              <OrderChip kind="fulfilment" value={order.fulfillmentStatus} />
            )}
            {order.isTest ? (
              <span title={listCopy.testChipHint}>
                <StatusChip tone="attention">{listCopy.testChip}</StatusChip>
              </span>
            ) : null}
            {soldThrough ? (
              <StatusChip tone="neutral" variant="outline">
                {salesChannelsContent.orderCard.via(soldThrough.name)}
              </StatusChip>
            ) : null}
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
