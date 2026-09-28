'use client'

import { Clock, ShoppingBag } from '@commerce/ui/icons'
import { type ReactNode, useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { methodLabel, type OrderDetail } from './order-detail-types'

/** Icon-badge tone for the order glyph square: what the header's own colour vocabulary reads. */
function headerTone(order: OrderDetail) {
  if (order.status === 'cancelled' || order.paymentStatus === 'refund_needed') {
    return 'danger' as const
  }
  if (order.status === 'completed') return 'success' as const
  if (order.fulfillmentStatus === 'returned') return 'danger' as const
  return 'warning' as const
}

export type Neighbours = Awaited<ReturnType<typeof api.orders.neighbours>>

type OrderHeaderProps = {
  order: OrderDetail
  /** The header actions, given the previous and next orders once they load. */
  actions: (neighbours: Neighbours | null) => ReactNode
}

/**
 * After the Saleor Dashboard order header (BSD-3): the order glyph in a bordered square
 * (a link back to the list), "Order #n" with its pills, a small grey meta line, and the
 * calm action set on the right.
 */
export default function OrderHeader({ order, actions }: OrderHeaderProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
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
  /* Open is the everyday state; only a closed order earns its own lifecycle pill. */
  const closed = order.status !== 'open'

  return (
    <div className="print:hidden">
      <PageHeader
        title={copy.title(order.number)}
        icon={<ShoppingBag aria-hidden="true" />}
        tone={headerTone(order)}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-muted-foreground" />
              {copy.placed(fmt.when(order.placedAt))}
            </span>
            {order.paymentMethod ? (
              <>
                <span aria-hidden="true">|</span>
                <span>
                  {copy.paidVia}:{' '}
                  <span className="text-foreground">{methodLabel(order.paymentMethod, copy)}</span>
                </span>
              </>
            ) : null}
          </span>
        }
        badges={
          <>
            {closed ? (
              <StatusLabel kind="order" value={order.status} variant="pill" size="sm" />
            ) : null}
            <StatusLabel kind="orderPayment" value={order.paymentStatus} variant="pill" size="sm" />
            <StatusLabel
              kind="fulfilment"
              value={order.fulfillmentStatus}
              variant="pill"
              size="sm"
            />
          </>
        }
        breadcrumbs={[{ label: copy.back, href: '/orders' }, { label: `#${order.number}` }]}
        actions={actions(neighbours)}
      />
    </div>
  )
}
