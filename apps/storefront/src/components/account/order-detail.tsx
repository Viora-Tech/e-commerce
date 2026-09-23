import { formatPaise } from '@commerce/blocks'
import type { ShopperOrderDetail } from '@commerce/core'
import Link from 'next/link'
import {
  accountContent,
  formatAccountDate,
  orderStatusLabels,
  paymentLabels,
  shipmentLabels,
  shipmentTone,
} from '@/data/account'
import { INDIAN_STATES } from '@/data/checkout'
import { reorderAction } from '@/lib/account-actions'
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
}

const copy = accountContent.order

const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

const signed = (paise: number) => `${paise < 0 ? '−' : '+'}${formatPaise(Math.abs(paise))}`

/** One order: status, lines, totals with the GST split, delivery tracking and documents. */
export default function OrderDetail({
  order: o,
  timeZone,
  paymentMethodLabel,
  links,
  reorderEmpty,
}: OrderDetailProps) {
  // Render logic
  const canReorder = o.lines.some((l) => l.purchasable)
  const buyAgain = reorderAction.bind(null, o.number)
  const gst = o.gst
  const card = 'flex flex-col gap-4 rounded-2xl border border-line p-6'
  const row = 'flex justify-between gap-4 text-body'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link href="/account" className="text-small text-muted hover:text-ink">
            ← {copy.back}
          </Link>
          <h2 className="h3">{accountContent.orders.order(o.number)}</h2>
          <p className="text-small text-muted">
            {copy.placedOn(formatAccountDate(o.placedAt, timeZone))}
          </p>
          <div className="flex flex-wrap gap-2">
            {o.status === 'cancelled' ? (
              <StatusPill label={orderStatusLabels.cancelled} tone="bad" />
            ) : (
              <StatusPill label={shipmentLabels[o.shipment]} tone={shipmentTone[o.shipment]} />
            )}
            <StatusPill
              label={paymentLabels[o.payment]}
              tone={o.payment === 'paid' ? 'good' : o.payment === 'failed' ? 'bad' : 'neutral'}
            />
          </div>
        </div>
        {canReorder ? (
          <form action={buyAgain}>
            <button type="submit" className="btn btn--primary">
              {copy.buyAgain}
            </button>
          </form>
        ) : null}
      </div>
      {reorderEmpty ? (
        <p className="text-body text-danger" role="status">
          {copy.reorderNone}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <section className={card} aria-labelledby="order-tracking">
            <h3 id="order-tracking" className="h4">
              {copy.tracking}
            </h3>
            <TrackingTimeline tracking={o.tracking} timeZone={timeZone} />
          </section>

          <section className={card} aria-labelledby="order-items">
            <h3 id="order-items" className="h4">
              {copy.items}
            </h3>
            <ul className="flex flex-col divide-y divide-line">
              {o.lines.map((l) => (
                <li key={l.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {l.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: product media is on the store's CDN.
                      <img src={l.imageUrl} alt="" className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {l.productHandle ? (
                      <Link
                        href={`/products/${l.productHandle}`}
                        className="text-body font-medium hover:underline"
                      >
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-body font-medium">{l.title}</span>
                    )}
                    {l.variantTitle && l.variantTitle !== 'Default' ? (
                      <span className="text-small text-muted">{l.variantTitle}</span>
                    ) : null}
                    <span className="text-small text-muted">
                      {copy.quantity(l.quantity)} × {formatPaise(l.unitPricePaise)}
                    </span>
                  </div>
                  <span className="text-body font-medium">{formatPaise(l.linePaise)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={card} aria-labelledby="order-summary">
            <h3 id="order-summary" className="h4">
              {copy.summary}
            </h3>
            <div className="flex flex-col gap-2">
              <div className={row}>
                <span>{copy.subtotal}</span>
                <span>{formatPaise(o.subtotalPaise)}</span>
              </div>
              {o.discountPaise > 0 ? (
                <div className={`${row} text-success`}>
                  <span>{o.discountLabel ?? copy.discount}</span>
                  <span>−{formatPaise(o.discountPaise)}</span>
                </div>
              ) : null}
              <div className={row}>
                <span>{copy.shipping}</span>
                <span>
                  {o.shippingPaise > 0 ? formatPaise(o.shippingPaise) : copy.shippingFree}
                </span>
              </div>
              {o.paymentAdjustmentPaise !== 0 ? (
                <div className={row}>
                  <span>
                    {o.paymentAdjustmentLabel ?? copy.adjustmentFallback(o.paymentAdjustmentPaise)}
                  </span>
                  <span>{signed(o.paymentAdjustmentPaise)}</span>
                </div>
              ) : null}
              <div className={`${row} border-t border-line pt-3 font-semibold`}>
                <span>{copy.total}</span>
                <span>{formatPaise(o.totalPaise)}</span>
              </div>
              {gst && gst.taxPaise > 0 ? (
                <div className="flex flex-col gap-1 pt-1 text-small text-muted">
                  <span>{copy.gstIncluded(formatPaise(gst.taxPaise))}</span>
                  {gst.interState ? (
                    <div className="flex justify-between">
                      <span>{copy.igst(gst.ratePercent)}</span>
                      <span>{formatPaise(gst.igstPaise)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>{copy.cgst(gst.ratePercent)}</span>
                        <span>{formatPaise(gst.cgstPaise)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{copy.sgst(gst.ratePercent)}</span>
                        <span>{formatPaise(gst.sgstPaise)}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {o.address ? (
            <section className={card} aria-labelledby="order-address">
              <h3 id="order-address" className="h4">
                {copy.shipTo}
              </h3>
              <address className="text-body not-italic">
                {o.address.name}
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
            </section>
          ) : null}

          <section className={card} aria-labelledby="order-payment">
            <h3 id="order-payment" className="h4">
              {copy.payment}
            </h3>
            <p className="text-body">
              {paymentMethodLabel ?? paymentLabels[o.payment]}
              <span className="block text-small text-muted">{paymentLabels[o.payment]}</span>
            </p>
            {o.email ? <p className="text-small text-muted">{o.email}</p> : null}
          </section>

          {links.length > 0 ? (
            <section className={card} aria-labelledby="order-documents">
              <h3 id="order-documents" className="h4">
                {copy.documents}
              </h3>
              <ul className="flex flex-col gap-2">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} className="text-body underline underline-offset-4">
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
