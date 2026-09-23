import { formatPaise } from '@commerce/blocks'
import type { ShopperOrderSummary } from '@commerce/core'
import Link from 'next/link'
import {
  accountContent,
  formatAccountDate,
  orderStatusLabels,
  paymentLabels,
  shipmentLabels,
  shipmentTone,
} from '@/data/account'
import StatusPill from './status-pill'

type OrderListProps = {
  orders: ShopperOrderSummary[]
  timeZone: string
}

const copy = accountContent.orders

const paymentTone = (p: ShopperOrderSummary['payment']) =>
  p === 'paid' ? 'good' : p === 'failed' || p === 'refunded' ? 'bad' : 'neutral'

/** The shopper's orders as cards: number, date, total, payment and delivery state. */
export default function OrderList({ orders, timeZone }: OrderListProps) {
  // Early returns
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line p-8">
        <h2 className="h4">{copy.emptyTitle}</h2>
        <p className="text-body text-muted">{copy.emptyBody}</p>
        <Link href="/collections" className="btn btn--primary mt-2">
          {copy.shop}
        </Link>
      </div>
    )
  }

  // Render logic
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/account/orders/${o.number}`}
            className="flex h-full gap-4 rounded-2xl border border-line p-5 transition-colors hover:border-ink"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface">
              {o.firstImage ? (
                // biome-ignore lint/performance/noImgElement: product media is on the store's CDN, as in the blocks package.
                <img
                  src={o.firstImage.url}
                  alt={o.firstImage.alt ?? ''}
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-semibold">{copy.order(o.number)}</span>
                <span className="text-body font-semibold">{formatPaise(o.totalPaise)}</span>
              </div>
              <span className="text-small text-muted">
                {copy.placedOn(formatAccountDate(o.placedAt, timeZone))} · {copy.items(o.itemCount)}
              </span>
              <div className="flex flex-wrap gap-2">
                {o.status === 'cancelled' ? (
                  <StatusPill label={orderStatusLabels.cancelled} tone="bad" />
                ) : (
                  <StatusPill label={shipmentLabels[o.shipment]} tone={shipmentTone[o.shipment]} />
                )}
                <StatusPill label={paymentLabels[o.payment]} tone={paymentTone(o.payment)} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
