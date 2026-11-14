import { formatPaise } from '@commerce/blocks'
import type { ShopperOrderDetail } from '@commerce/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import {
  accountContent,
  formatAccountDate,
  orderStatusLabels,
  paymentLabels,
  paymentPillShown,
  shipmentLabels,
  shipmentTone,
} from '@/data/account'
import { INDIAN_STATES } from '@/data/indian-states'
import { reorderAction } from '@/lib/account-actions'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_LINK,
  ACCOUNT_TITLE,
} from '@/lib/account-classes'
import { CK_BUTTON_SECONDARY, CK_LIFT } from '@/lib/checkout-classes'
import { shopperParcels } from '@/lib/parcels'
import OrderParcels from './order-parcels'
import OrderSummaryCard from './order-summary-card'
import StatusPill from './status-pill'
import TrackingTimeline from './tracking-timeline'

type OrderDetailProps = {
  order: ShopperOrderDetail
  timeZone: string
  /** What the shopper paid with, as the store labels it. */
  paymentMethodLabel: string | null
  /** Invoice and other documents from installed apps. */
  links: { label: string; url: string }[]
  /** Set after a "Buy again" where nothing could be added. */
  reorderEmpty: boolean
  /** A deposit pre-order's "Pay balance" block, when a balance is still owed. */
  balance?: ReactNode
  /** The returns section: return window, start button and returns so far. */
  returns?: ReactNode
}

const copy = accountContent.order

const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/**
 * One order (Figma 705:114449, 705:114664): back to the list, the number with its state, then
 * cards for tracking, parcels, items and returns; summary, address with payment and documents
 * beside them from `lg`, under them on a phone. Each card rises in on load.
 */
export default function OrderDetail({
  order: o,
  timeZone,
  paymentMethodLabel,
  links,
  reorderEmpty,
  balance = null,
  returns = null,
}: OrderDetailProps) {
  // Render logic
  const canReorder = o.lines.some((l) => l.purchasable)
  const buyAgain = reorderAction.bind(null, o.number)
  const card = ACCOUNT_CARD
  const title = ACCOUNT_CARD_TITLE

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${CK_LIFT}`}>
        <div className="flex flex-col gap-1.5">
          <Link href="/account" className={`${ACCOUNT_LINK} -my-2 self-start text-ck-muted!`}>
            <CheckoutIcon name="back" className="size-3.5" />
            {copy.back}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className={ACCOUNT_TITLE}>{accountContent.orders.order(o.number)}</h1>
            {o.status === 'cancelled' ? (
              <StatusPill label={orderStatusLabels.cancelled} tone="bad" />
            ) : (
              <StatusPill label={shipmentLabels[o.shipment]} tone={shipmentTone[o.shipment]} />
            )}
            {paymentPillShown(o.status, o.payment) ? (
              <StatusPill
                label={paymentLabels[o.payment]}
                tone={o.payment === 'paid' ? 'good' : o.payment === 'failed' ? 'bad' : 'neutral'}
              />
            ) : null}
          </div>
          <p className="text-[0.875rem] text-ck-muted">
            {copy.placedOn(formatAccountDate(o.placedAt, timeZone))}
          </p>
        </div>
        {canReorder ? (
          <form action={buyAgain}>
            <button type="submit" className={`${CK_BUTTON_SECONDARY} w-full sm:w-auto`}>
              <CheckoutIcon name="refresh" className="size-4" />
              {copy.buyAgain}
            </button>
          </form>
        ) : null}
      </div>
      {reorderEmpty ? (
        <p className="text-[0.9375rem] text-ck-danger" role="status">
          {copy.reorderNone}
        </p>
      ) : null}
      {o.status === 'cancelled' ? (
        <div className="rounded-ck border border-ck-line bg-ck-soft px-4 py-3" role="note">
          <p className="text-[0.9375rem] font-medium text-ck-ink">{copy.notices.cancelled}</p>
          <p className="text-[0.8125rem] text-ck-muted">{copy.notices.cancelledBody}</p>
        </div>
      ) : o.shipment === 'rto' ? (
        <div
          className="flex gap-3 rounded-ck border border-ck-danger/40 bg-ck-danger-soft px-4 py-3 text-ck-danger"
          role="alert"
        >
          <CheckoutIcon name="alert" className="mt-0.5! size-4" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[0.9375rem] font-medium">{copy.notices.failed}</p>
            <p className="text-[0.8125rem]">{copy.notices.failedBody}</p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4 sm:gap-6">
          <section className={card} aria-labelledby="order-tracking">
            <h2 id="order-tracking" className={title}>
              {copy.tracking}
            </h2>
            <TrackingTimeline
              tracking={o.tracking}
              timeZone={timeZone}
              fulfillmentStatus={o.fulfillmentStatus}
            />
          </section>

          <OrderParcels parcels={shopperParcels(o.parcels)} />

          <section className={card} aria-labelledby="order-items">
            <h2 id="order-items" className={title}>
              {copy.items}
            </h2>
            <ul className="flex flex-col divide-y divide-ck-line">
              {o.lines.map((l) => (
                <li key={l.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {/* No picture, no empty grey box (#163). */}
                  {l.imageUrl ? (
                    <div className="size-14 shrink-0 overflow-hidden rounded-ck bg-ck-soft sm:size-16">
                      {/* biome-ignore lint/performance/noImgElement: product media is on the store's CDN. */}
                      <img src={l.imageUrl} alt="" className="size-full! object-cover" />
                    </div>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {l.productHandle ? (
                      <Link
                        href={`/products/${l.productHandle}`}
                        className="text-[0.9375rem] font-medium text-ck-ink! no-underline hover:underline"
                      >
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-[0.9375rem] font-medium">{l.title}</span>
                    )}
                    {l.variantTitle && l.variantTitle !== 'Default' ? (
                      <span className="text-[0.8125rem] text-ck-muted">{l.variantTitle}</span>
                    ) : null}
                    <span className="text-[0.8125rem] text-ck-muted">
                      {copy.quantity(l.quantity)} × {formatPaise(l.unitPricePaise)}
                    </span>
                  </div>
                  <span className="text-[0.9375rem] font-medium tabular-nums">
                    {formatPaise(l.linePaise)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {returns}
        </div>

        <div className="flex flex-col gap-4 sm:gap-6">
          {balance}
          <OrderSummaryCard order={o} />

          {/* Address and payment share one card, as in the design. */}
          <section className={card} aria-labelledby={o.address ? 'order-address' : 'order-payment'}>
            {o.address ? (
              <div className="flex flex-col gap-2">
                <h2 id="order-address" className={title}>
                  {copy.shipTo}
                </h2>
                <address className="text-[0.9375rem] leading-relaxed text-ck-muted not-italic">
                  <span className="text-ck-ink">{o.address.name}</span>
                  <br />
                  {o.address.line1}
                  {o.address.line2 ? (
                    <>
                      <br />
                      {o.address.line2}
                    </>
                  ) : null}
                  <br />
                  {o.address.city}, {stateName(o.address.stateCode)} {o.address.pincode}
                  <br />
                  {o.address.phone}
                </address>
              </div>
            ) : null}
            <div
              className={`flex flex-col gap-1.5 ${o.address ? 'border-t border-ck-line pt-4' : ''}`}
            >
              <h2 id="order-payment" className={o.address ? `${title} text-[0.9375rem]!` : title}>
                {copy.payment}
              </h2>
              <p className="text-[0.9375rem]">
                {paymentMethodLabel ?? paymentLabels[o.payment]}
                {/* "Cash on delivery" is both the method and the state: say it once. */}
                {paymentMethodLabel && paymentMethodLabel !== paymentLabels[o.payment] ? (
                  <span className="text-ck-muted"> · {paymentLabels[o.payment]}</span>
                ) : null}
              </p>
              {o.email ? (
                <p className="text-[0.8125rem] break-all text-ck-muted">{o.email}</p>
              ) : null}
            </div>
          </section>

          {links.length > 0 ? (
            <section className={card} aria-labelledby="order-documents">
              <h2 id="order-documents" className={title}>
                {copy.documents}
              </h2>
              <ul className="flex flex-col gap-2">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} className={`${CK_BUTTON_SECONDARY} w-full`}>
                      <CheckoutIcon name="download" className="size-4" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
