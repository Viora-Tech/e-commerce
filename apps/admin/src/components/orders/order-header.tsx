'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import { api } from '@/lib/api-client'
import { formatWhen } from '@/lib/format-date'
import type { OrderDetail, OrderStatus } from './order-detail-types'

type OrderHeaderProps = {
  order: OrderDetail
  payment: StatusValue<'payment'>
  fulfilment: StatusValue<'fulfilment'>
  actions: React.ReactNode
}

type Neighbours = Awaited<ReturnType<typeof api.orders.neighbours>>

function StepLink({ id, label, icon }: { id?: string; label: string; icon: React.ReactNode }) {
  if (!id) {
    return (
      <Button variant="outline" size="icon" aria-label={label} disabled>
        {icon}
      </Button>
    )
  }
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      render={<Link href={`/orders/${id}`} />}
    >
      {icon}
    </Button>
  )
}

/** Title, when it was placed, where it stands, and the way to the next order. */
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
        subtitle={copy.placed(formatWhen(order.placedAt))}
        badges={
          <>
            {order.status === cancelled ? (
              <StatusLabel kind="order" value="cancelled" variant="pill" />
            ) : null}
            <StatusLabel kind="payment" value={payment} variant="pill" />
            <StatusLabel kind="fulfilment" value={fulfilment} variant="pill" />
          </>
        }
        breadcrumbs={[{ label: copy.back, href: '/orders' }, { label: `#${order.number}` }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <StepLink
                id={neighbours?.previous?.id}
                label={copy.previous}
                icon={<ChevronLeftIcon className="size-4" />}
              />
              <StepLink
                id={neighbours?.next?.id}
                label={copy.next}
                icon={<ChevronRightIcon className="size-4" />}
              />
            </div>
            {actions}
          </div>
        }
      />
    </div>
  )
}
