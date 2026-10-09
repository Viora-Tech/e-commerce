'use client'

import { ChevronLeftIcon, ShoppingBag } from '@commerce/ui/icons'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { orderDetailContent } from '@/data/orders'
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

  return (
    <div className="flex flex-col gap-4 print:hidden">
      <Link
        href={routes.orders.list()}
        className="flex w-fit items-center gap-1 text-body text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {copy.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-hairline bg-primary-soft text-primary [&_svg]:size-6"
          >
            <ShoppingBag />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-page-title text-ink-strong">
                {copy.title(order.number)}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {closed ? <OrderChip kind="order" value={order.status} /> : null}
                <OrderChip kind="orderPayment" value={order.paymentStatus} />
                <OrderChip kind="fulfilment" value={order.fulfillmentStatus} />
              </div>
            </div>
            <p className="text-body text-muted-foreground">
              <span title={fmt.dateTime(order.placedAt)}>
                {copy.placed(fmt.ago(order.placedAt))}
              </span>
              {order.paymentMethod ? (
                <>
                  {' · '}
                  {copy.paidVia}: {methodLabel(order.paymentMethod, copy)}
                </>
              ) : null}
            </p>
          </div>
        </div>
        {actions(neighbours)}
      </div>
    </div>
  )
}
