'use client'

import { ShoppingBag } from '@commerce/ui/icons'
import { type ReactNode, useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import { api } from '@/lib/api-client'
import { formatWhen } from '@/lib/format-date'
import { methodLabel, type OrderDetail, type OrderStatus } from './order-detail-types'

export type Neighbours = Awaited<ReturnType<typeof api.orders.neighbours>>

type OrderHeaderProps = {
  order: OrderDetail
  payment: StatusValue<'payment'>
  fulfilment: StatusValue<'fulfilment'>
  /** The header actions, given the previous and next orders once they load. */
  actions: (neighbours: Neighbours | null) => ReactNode
}

/**
 * After the Saleor Dashboard order header (BSD-3): the order glyph in a bordered square
 * (a link back to the list), "Order #n" with its pills, a small grey meta line, and the
 * calm action set on the right.
 */
export default function OrderHeader({ order, payment, fulfilment, actions }: OrderHeaderProps) {
  // Hooks
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
  const cancelled: OrderStatus = 'cancelled'

  return (
    <div className="print:hidden">
      <PageHeader
        title={copy.title(order.number)}
        icon={<ShoppingBag aria-hidden="true" />}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{copy.placed(formatWhen(order.placedAt))}</span>
            {order.paymentMethod ? (
              <>
                <span aria-hidden="true">|</span>
                <span>
                  {copy.paidVia}:{' '}
                  <span className="text-foreground">{methodLabel(order.paymentMethod)}</span>
                </span>
              </>
            ) : null}
          </span>
        }
        badges={
          <>
            {order.status === cancelled ? (
              <StatusLabel kind="order" value="cancelled" variant="pill" size="sm" />
            ) : null}
            <StatusLabel kind="payment" value={payment} variant="pill" size="sm" />
            <StatusLabel kind="fulfilment" value={fulfilment} variant="pill" size="sm" />
          </>
        }
        breadcrumbs={[{ label: copy.back, href: '/orders' }, { label: `#${order.number}` }]}
        actions={actions(neighbours)}
      />
    </div>
  )
}
