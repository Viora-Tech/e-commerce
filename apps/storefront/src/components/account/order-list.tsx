import { formatPaise } from '@commerce/blocks'
import type { ShopperOrderSummary } from '@commerce/core'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import {
  accountContent,
  formatAccountDate,
  orderStatusLabels,
  paymentLabels,
  shipmentLabels,
  shipmentTone,
} from '@/data/account'
import { ACCOUNT_CARD, ACCOUNT_CARD_TITLE, ACCOUNT_STAGGER } from '@/lib/account-classes'
import { CK_BUTTON_PRIMARY, CK_CARD, CK_LIFT } from '@/lib/checkout-classes'
import StatusPill from './status-pill'

type OrderListProps = {
  orders: ShopperOrderSummary[]
  timeZone: string
}

const copy = accountContent.orders

const paymentTone = (p: ShopperOrderSummary['payment']) =>
  p === 'paid' ? 'good' : p === 'failed' || p === 'refunded' ? 'bad' : 'neutral'

/** The pictures a card shows: its thumbnails, or the one first image an older summary carries. */
const pictures = (o: ShopperOrderSummary) =>
  o.thumbnails.length > 0 ? o.thumbnails : o.firstImage ? [o.firstImage] : []

/**
 * The shopper's orders as cards (Figma 705:114276): number and date with the delivery state on
 * the right, then the products' pictures and the total. Payment shows only when it is not
 * simply paid (cash on delivery, pending, failed, refunded). Cards rise in one after another.
 */
export default function OrderList({ orders, timeZone }: OrderListProps) {
  // Early returns
  if (orders.length === 0) {
    return (
      <div
        className={`${CK_CARD} ${CK_LIFT} flex flex-col items-center gap-3 px-6 py-10 text-center`}
      >
        <span className="grid size-12 place-items-center rounded-full bg-ck-soft text-ck-muted">
          <CheckoutIcon name="bag" className="size-5" />
        </span>
        <h2 className={ACCOUNT_CARD_TITLE}>{copy.emptyTitle}</h2>
        <p className="max-w-[22rem] text-[0.9375rem] text-ck-muted">{copy.emptyBody}</p>
        <Link href="/collections" className={`${CK_BUTTON_PRIMARY} mt-2 w-auto!`}>
          {copy.shop}
        </Link>
      </div>
    )
  }

  // Render logic
  return (
    <ul className="grid gap-3 sm:gap-4">
      {orders.map((o, i) => {
        const shots = pictures(o)
        return (
          <li key={o.id}>
            <Link
              href={`/account/orders/${o.number}`}
              style={{ '--i': i } as CSSProperties}
              className={`${ACCOUNT_CARD} ${ACCOUNT_STAGGER} gap-4! text-ck-ink! no-underline outline-none transition-[scale,box-shadow] duration-(--duration-press) ease-out focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] active:scale-(--motion-card-press-scale)`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[1rem] font-semibold">{copy.order(o.number)}</span>
                  <span className="text-[0.8125rem] text-ck-muted">
                    {copy.placedOn(formatAccountDate(o.placedAt, timeZone))} ·{' '}
                    {copy.items(o.itemCount)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {o.status === 'cancelled' ? (
                    <StatusPill label={orderStatusLabels.cancelled} tone="bad" />
                  ) : (
                    <StatusPill
                      label={shipmentLabels[o.shipment]}
                      tone={shipmentTone[o.shipment]}
                    />
                  )}
                  {o.payment === 'paid' ? null : (
                    <StatusPill label={paymentLabels[o.payment]} tone={paymentTone(o.payment)} />
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between gap-3">
                {/* No picture, no empty box (#163). */}
                <div className="flex min-w-0 items-center gap-2">
                  {shots.map((s, n) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: two products may share one picture.
                      key={n}
                      className="size-12 shrink-0 overflow-hidden rounded-ck bg-ck-soft sm:size-14"
                    >
                      {/* biome-ignore lint/performance/noImgElement: product media is on the store's CDN, as in the blocks package. */}
                      <img src={s.url} alt={s.alt ?? ''} className="size-full! object-cover" />
                    </span>
                  ))}
                </div>
                <span className="text-[1rem] font-semibold tabular-nums">
                  {formatPaise(o.totalPaise)}
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
