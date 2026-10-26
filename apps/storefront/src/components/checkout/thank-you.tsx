import { formatPaise } from '@commerce/blocks'
import type { CheckoutLook } from '@commerce/core'
import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import type { address, order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import type { ReactNode } from 'react'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import CheckoutStepsShell from '@/components/checkout/checkout-steps-shell'
import OrderDetails from '@/components/checkout/order-details'
import OrderProgress from '@/components/checkout/order-progress'
import OrderSummary from '@/components/checkout/order-summary'
import StatusMark from '@/components/checkout/status-mark'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import ThankYouCard from '@/components/checkout/thank-you-card'
import TransferInstructions from '@/components/checkout/transfer-instructions'
import UpiQrPayment from '@/components/checkout/upi-qr-payment'
import { thankYouContent as content } from '@/data/checkout'
import { retryPaymentAction } from '@/lib/cart-actions'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_HEADING } from '@/lib/checkout-classes'
import type { ShopperParcel } from '@/lib/parcels'
import { deliveryWindow, firstName, thankYouProgress } from '@/lib/thank-you'

type ThankYouTemplateProps = {
  order: typeof order.$inferSelect
  lines: (typeof orderLine.$inferSelect)[]
  /** The latest gateway, COD or transfer attempt; undefined when gift cards paid everything. */
  payment: typeof payment.$inferSelect | undefined
  /** Gift cards spent on the order. */
  giftCards?: { id: string; last: string; amountPaise: number }[]
  /** Links from installed apps, e.g. a signed invoice download. */
  links?: { label: string; url: string }[]
  /** A deposit pre-order's balance block, when a balance is still owed. */
  balance?: ReactNode
  /** The signed `/checkout/pay/...` path for "Pay now", token included. */
  payPath: string
  /** The order's view token; "Retry payment" and the UPI QR prove access with it. */
  viewToken: string
  look: CheckoutLook
  /** Variant images by variant id, for the summary's thumbnails. */
  images?: Record<string, string>
  /** The delivery address snapshot; null for an emailed gift card. */
  shipTo?: typeof address.$inferSelect | null
  /** Where each part ships from; listed when the order left from more than one warehouse. */
  parcels?: ShopperParcel[]
  /** The latest courier shipment's status, or null before one is booked. */
  shipmentStatus?: string | null
  /** "Track your order": the courier's tracking page, else the signed-in owner's order page. */
  track?: { href: string; external: boolean } | null
}

/** Attempts still waiting on the shopper or the gateway. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(OPEN_ATTEMPT_STATUSES)

/** The first card's line while the order still waits on its payment. */
function pendingLine(failed: boolean, manual: boolean, qr: boolean, total: string): string {
  if (failed) return content.status.failed(total)
  if (manual) return content.status.manual
  if (qr) return content.status.upiQr(total)
  return content.status.awaiting(total)
}

/**
 * The thank-you page (Figma Checkout v2 / Thank you), in the one-page checkout's frame. A tick
 * in the accent, "Order #1001" and "Thank you, Asha!", then two white cards: where the order
 * stands (the updates line, the delivery window when one was worked out, and Confirmed /
 * Packed / Shipped / Delivered), and its details (contact, payment, address, shipping) with
 * "Track your order" and the apps' downloads. While the payment is still open the first card
 * holds what the shopper has to do instead: scan the UPI QR, make the transfer, pay now or
 * retry a failed payment. The order summary stays on the right, folded on a phone.
 */
export default function ThankYouTemplate({
  order: o,
  lines,
  payment: pay,
  giftCards = [],
  links = [],
  balance = null,
  payPath,
  viewToken,
  look,
  images = {},
  shipTo = null,
  parcels = [],
  shipmentStatus = null,
  track = null,
}: ThankYouTemplateProps) {
  // Render logic
  const awaiting = o.paymentMethod !== 'cod' && OPEN_STATUSES.has(pay?.status ?? '')
  // The latest attempt failed on an order that is still open: offer a new attempt.
  const failed =
    o.status === 'open' &&
    !o.checkoutPaidAt &&
    (pay?.status === 'failed' || pay?.status === 'cancelled')
  const session = (pay?.checkoutSession ?? null) as CheckoutSession | null
  // An attempt made for a pay link (a plan bill, an invoice) that nobody has started yet.
  const notStarted =
    o.status === 'open' && !o.checkoutPaidAt && pay?.status === 'created' && session === null
  const manual = awaiting && session?.kind === 'manual' ? session.instructions : null
  const qr = awaiting && session?.kind === 'upi_qr' ? session.qr : null
  // What the shopper still pays after gift cards: the amount COD, transfer and gateway lines quote.
  const due = formatPaise(pay?.amountPaise ?? o.totalPaise)
  const settled = !failed && !awaiting
  const boughtCards = lines.length > 0 && lines.every((l) => l.giftCard)
  const progress = thankYouProgress({
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    shipmentStatus,
    deliveredAt: o.deliveredAt,
  })
  const arrival =
    progress.reached !== null && progress.reached < 3
      ? deliveryWindow(parcels.filter((p) => !p.onHold).map((p) => p.estimate))
      : null
  const cardTitle = progress.end
    ? content.card[progress.end]
    : failed
      ? content.card.failed
      : awaiting
        ? content.card.pending
        : content.card.confirmed
  const line = !settled
    ? pendingLine(failed, manual !== null, qr !== null, due)
    : progress.end
      ? null
      : boughtCards
        ? content.status.giftCardEmail(o.email)
        : [content.updates(o.email ?? o.phone), arrival ? content.arrives(arrival) : null]
            .filter(Boolean)
            .join(' ')
  const retry = failed || notStarted
  const payClient = awaiting && session?.kind === 'client'
  const trackLink = settled && !progress.end ? track : null

  return (
    <CheckoutStepsShell
      look={look}
      backHref="/"
      backLabel={content.continueShopping}
      headerEnd={
        <a
          href="/"
          className="-my-2! flex min-h-11 items-center text-ck-muted! no-underline outline-none transition-colors duration-150 hover:text-ck-ink! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
        >
          {content.continueShopping}
        </a>
      }
      summary={
        <SummaryDisclosure totalLabel={formatPaise(o.totalPaise)}>
          <OrderSummary order={o} lines={lines} images={images} giftCards={giftCards} />
        </SummaryDisclosure>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <StatusMark tone={failed ? 'failed' : awaiting ? 'pending' : 'confirmed'} />
          <div className="flex flex-col gap-1">
            <p className="text-[0.875rem] font-medium text-ck-muted tabular-nums">
              {content.orderNumber(o.number)}
            </p>
            <h1 className={`${CK_HEADING} text-[1.75rem]! text-balance sm:text-[2rem]!`}>
              {settled
                ? content.thanks(firstName(shipTo?.name))
                : failed
                  ? content.headline.failed
                  : content.headline.pending}
            </h1>
          </div>
        </div>

        <ThankYouCard id="order-status-heading" title={cardTitle}>
          {line ? <p className="text-[0.9375rem] text-pretty text-ck-muted">{line}</p> : null}
          {settled && shipTo && progress.reached !== null ? (
            <OrderProgress reached={progress.reached} />
          ) : null}
          {manual ? <TransferInstructions instructions={manual} amountLabel={due} /> : null}
          {qr ? (
            <UpiQrPayment orderNumber={o.number} viewToken={viewToken} qr={qr} amountLabel={due} />
          ) : null}
          {balance}
          {retry ? (
            <form action={retryPaymentAction.bind(null, o.number, viewToken)}>
              <button type="submit" className={CK_BUTTON_PRIMARY}>
                {notStarted
                  ? content.payNow
                  : session?.kind === 'upi_qr'
                    ? content.newQr
                    : content.retryPayment}
              </button>
            </form>
          ) : null}
          {payClient ? (
            <a href={payPath} className={`${CK_BUTTON_PRIMARY} no-underline`}>
              {content.payNow}
            </a>
          ) : null}
        </ThankYouCard>

        <ThankYouCard id="order-details-heading" title={content.details.heading}>
          <OrderDetails order={o} shipTo={shipTo} payment={pay} giftCards={giftCards} />
          <CheckoutParcels parcels={parcels} />
          {trackLink || links.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-ck-line pt-5 sm:flex-row sm:flex-wrap">
              {trackLink ? (
                <a
                  href={trackLink.href}
                  {...(trackLink.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`${CK_BUTTON_PRIMARY} h-11! text-[0.9375rem]! no-underline sm:w-auto`}
                >
                  {content.trackOrder}
                </a>
              ) : null}
              {links.map((l) => (
                <a key={l.url} href={l.url} className={`${CK_BUTTON_SECONDARY} w-full sm:w-auto`}>
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
        </ThankYouCard>
      </div>
    </CheckoutStepsShell>
  )
}
