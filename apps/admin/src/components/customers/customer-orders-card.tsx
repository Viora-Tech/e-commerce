'use client'

import { ArrowRight, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import type { CustomerDetail } from './customer-detail-types'
import OrderStatusChip from './order-status-chip'

type CustomerOrdersCardProps = {
  customer: CustomerDetail
}

/** How many orders the card lists; the rest are one click away on the orders page. */
const RECENT = 5

/* Order, date, status (centred), total, then the open arrow. */
const ROW = 'grid grid-cols-[5rem_minmax(0,1fr)_7rem_6.5rem_1.5rem] items-center gap-x-3 px-5'

/** The last few orders, newest first, each linking into the order page. */
export default function CustomerOrdersCard({ customer }: CustomerOrdersCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent).orders

  // Render logic
  const orders = customer.orders
  const recent = orders.slice(0, RECENT)
  const viewAll = customer.email
    ? `${routes.orders.list()}?query=${encodeURIComponent(customer.email)}`
    : routes.orders.list()

  return (
    <DataCard
      title={copy.heading}
      className="rounded-xl"
      flush
      icon={
        <span className="rounded-md bg-chip-neutral px-1.5 text-caption font-medium text-muted-foreground tabular-nums">
          {orders.length}
        </span>
      }
      action={
        orders.length > 0 ? (
          <Button variant="ghost" size="sm" render={<Link href={viewAll} />} nativeButton={false}>
            {copy.viewAll}
          </Button>
        ) : null
      }
    >
      {orders.length === 0 ? (
        <EmptyState
          heading={copy.emptyHeading}
          body={copy.emptyBody}
          action={
            <Button
              variant="outline"
              render={<Link href={routes.orders.newDraft()} />}
              nativeButton={false}
            >
              <Plus />
              {copy.createOrder}
            </Button>
          }
        />
      ) : (
        <>
          <div
            className={cn(ROW, 'h-10 bg-muted/60 text-caption font-medium text-muted-foreground')}
          >
            <span>{copy.columns.order}</span>
            <span>{copy.columns.date}</span>
            <span className="text-center">{copy.columns.status}</span>
            <span className="text-right">{copy.columns.total}</span>
            <span />
          </div>
          {recent.map((o) => (
            <Link
              key={o.id}
              href={routes.orders.detail(o.id)}
              className={cn(
                ROW,
                'group/order h-12 border-b border-line text-body text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              )}
            >
              <span className="font-medium tabular-nums">#{o.number}</span>
              <RelativeTime value={o.placedAt} className="text-muted-foreground" />
              <span className="flex justify-center">
                <OrderStatusChip order={o} />
              </span>
              <span className="text-right tabular-nums">{formatPaise(o.totalPaise)}</span>
              <ArrowRight
                className="size-4 text-muted-foreground opacity-40 transition-opacity group-hover/order:opacity-100"
                aria-hidden
              />
            </Link>
          ))}
          <div className="flex items-center justify-between gap-3 px-5 pt-4 text-caption text-muted-foreground">
            <span>{copy.showing(recent.length, orders.length)}</span>
            <Link
              href={viewAll}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {copy.viewAll}
            </Link>
          </div>
        </>
      )}
    </DataCard>
  )
}
