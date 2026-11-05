import { formatPaise } from '@commerce/blocks'
import type { CheckoutLook } from '@commerce/core'
import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import type { address, order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutPageShell from '@/components/checkout/checkout-page-shell'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import OrderDetails from '@/components/checkout/order-details'
import OrderSummary from '@/components/checkout/order-summary'
import StatusMark from '@/components/checkout/status-mark'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import ThankYouCard from '@/components/checkout/thank-you-card'
import ThankYouConfirming from '@/components/checkout/thank-you-confirming'
import ThankYouDelivery from '@/components/checkout/thank-you-delivery'
import ThankYouFailed from '@/components/checkout/thank-you-failed'
import TransferInstructions from '@/components/checkout/transfer-instructions'
import UpiQrPayment from '@/components/checkout/upi-qr-payment'
import { thankYouContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_CARD, CK_HEADING } from '@/lib/checkout-classes'
import type { ShopperParcel } from '@/lib/parcels'
import { payOnlineAction, retryPaymentAction } from '@/lib/payment-actions'
import { deliveryWindow, thankYouProgress } from '@/lib/thank-you'
import { whatsAppHelp } from '@/lib/whatsapp-help'

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
  /** A transfer order can pay through the store's gateway instead; false when it has none. */
  canPayOnline?: boolean
}

/** Attempts still waiting on the shopper or the gateway. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(OPEN_ATTEMPT_STATUSES)

/**
 * While the status mark settles and its tick draws (`StatusMark`, 400ms), the headline and the
 * two cards rise in one after another, 50ms apart: an 8px rise with a fade on the strong
 * ease-out, the fade alone with reduced motion. CSS animations, so they play once when the page
 * mounts and never on a re-render.
 */
const ENTER = [
  'motion-safe:animate-[sf-rise_260ms_var(--ease-out)_140ms_both] motion-reduce:animate-[sf-fade_200ms_var(--ease-out)_140ms_both]',
  'motion-safe:animate-[sf-rise_260ms_var(--ease-out)_190ms_both] motion-reduce:animate-[sf-fade_200ms_var(--ease-out)_190ms_both]',
  'motion-safe:animate-[sf-rise_260ms_var(--ease-out)_240ms_both] motion-reduce:animate-[sf-fade_200ms_var(--ease-out)_240ms_both]',
] as const

/** The line under the headline while the order still waits on its payment. */
function pendingLine(failed: boolean, manual: boolean, qr: boolean, total: string): string {
  if (failed) return content.status.failed(total)
  if (manual) return content.status.manual
  if (qr) return content.status.upiQr(total)
  return content.status.awaiting(total)
}

/**
 * The result page (Figma Checkout · Polish): the status and what it means, the order number,
 * then what the moment needs. Waiting on a payment that means the UPI QR, the transfer details
 * or Pay now; just paid, "Confirming your payment…"; failed, what was tried and how to go again.
 * Once placed, the Delivery card with its progress and the actions. Order details keep the
 * contact, the payment and the apps' downloads. The summary stays on the right, folded on a phone.
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
  canPayOnline = false,
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
  const payClient = awaiting && session?.kind === 'client'
  const payOnline = manual !== null && canPayOnline
  const retry = failed || notStarted
  // Paid and not yet answered: nothing for the shopper to do but wait.
  const confirming = awaiting && manual === null && qr === null && !payClient
  const headline = progress.end
    ? content.card[progress.end]
    : failed
      ? content.headline.failed
      : awaiting || notStarted
        ? content.headline.pending
        : content.card.confirmed
  const statusLines = !settled
    ? [pendingLine(failed, manual !== null, qr !== null, due)]
    : progress.end
      ? []
      : boughtCards
        ? [content.status.giftCardEmail(o.email)]
        : [
            ...(o.paymentMethod === 'cod' && !o.checkoutPaidAt ? [content.codDue(due)] : []),
            content.updates(o.email ?? o.phone),
          ]
  const trackLink = settled && !progress.end ? track : null
  const number = `#${o.number}`
  const method = o.paymentMethod
    ? (content.methods[o.paymentMethod] ?? content.methods.online ?? '')
    : (content.methods.online ?? '')
  const showDelivery = shipTo !== null && !failed && !progress.end && !confirming
  const deliveryAddress = shipTo
    ? [shipTo.name, shipTo.line1, shipTo.line2, shipTo.city, shipTo.pincode]
        .filter(Boolean)
        .join(', ')
    : ''
  const continueLink = (
    <a href="/" className={`${CK_BUTTON_SECONDARY} h-13! no-underline`}>
      {content.continueShopping}
    </a>
  )
  const retryButton = retry ? (
    <form
      action={retryPaymentAction.bind(null, o.number, viewToken)}
      className={failed ? 'min-w-0 flex-1' : ''}
    >
      <button type="submit" className={CK_BUTTON_PRIMARY}>
        {failed ? <CheckoutIcon name="refresh" className="size-[1.125rem]" /> : null}
        {notStarted
          ? content.payNow
          : session?.kind === 'upi_qr'
            ? content.newQr
            : content.retryPayment}
      </button>
    </form>
  ) : null

  return (
    <CheckoutPageShell
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
      <div className="flex flex-col gap-6 max-lg:pt-2">
        {confirming ? (
          <div className={`flex flex-col gap-6 ${ENTER[0]}`}>
            <ThankYouConfirming
              rows={[
                [content.confirming.amount, due],
                [content.confirming.paidWith, method],
                [content.confirming.order, content.confirming.held(number)],
              ]}
            />
          </div>
        ) : (
          <>
            <div className={`flex flex-col gap-3.5 ${ENTER[0]}`}>
              <div className="flex items-center gap-3.5">
                <StatusMark
                  tone={failed ? 'failed' : awaiting || notStarted ? 'pending' : 'success'}
                />
                <h1
                  className={`${CK_HEADING} text-[1.375rem]! font-bold! text-balance sm:text-[1.875rem]!`}
                >
                  {headline}
                </h1>
              </div>
              {statusLines.map((text) => (
                <p
                  key={text}
                  className="text-[0.9375rem] leading-[1.375rem] text-pretty text-ck-muted"
                >
                  {text}
                </p>
              ))}
            </div>
            {failed ? (
              <div className={`flex flex-col gap-6 ${ENTER[1]}`}>
                <ThankYouFailed
                  rows={[
                    [content.confirming.amount, due],
                    [content.confirming.paidWith, method],
                    [content.confirming.order, number],
                  ]}
                  help={whatsAppHelp(look.contactPhone)}
                  actions={
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      {continueLink}
                      {retryButton}
                    </div>
                  }
                />
              </div>
            ) : (
              <div className={`flex flex-col gap-6 ${ENTER[1]}`}>
                <div className={`${CK_CARD} flex h-15 items-center justify-between gap-4 px-4`}>
                  <span className="text-[0.875rem] leading-5 text-ck-muted">
                    {content.orderNumberLabel}
                  </span>
                  <span className="text-[1.25rem] leading-6 font-bold text-ck-ink tabular-nums">
                    {number}
                  </span>
                </div>
                {manual ? <TransferInstructions instructions={manual} amountLabel={due} /> : null}
                {payOnline ? (
                  <form
                    action={payOnlineAction.bind(null, o.number, viewToken)}
                    className={`${CK_CARD} flex flex-col gap-3 p-5`}
                  >
                    <h2 className={`${CK_HEADING} text-[1.0625rem]!`}>
                      {content.payOnline.heading}
                    </h2>
                    <p className="text-[0.875rem] leading-5 text-pretty text-ck-muted">
                      {content.payOnline.body}
                    </p>
                    {o.paymentAdjustmentPaise < 0 ? (
                      <p className="text-[0.875rem] leading-5 font-medium text-pretty text-ck-warn">
                        {content.payOnline.noDiscount(
                          o.paymentAdjustmentLabel ??
                            content.adjustmentFallback(o.paymentAdjustmentPaise),
                          formatPaise(-o.paymentAdjustmentPaise),
                          formatPaise(
                            (pay?.amountPaise ?? o.totalPaise) - o.paymentAdjustmentPaise,
                          ),
                        )}
                      </p>
                    ) : null}
                    <button type="submit" className={CK_BUTTON_PRIMARY}>
                      {content.payOnline.action}
                    </button>
                    <p className="text-[0.8125rem] leading-[1.1875rem] text-pretty text-ck-muted">
                      {content.payOnline.alreadySent}
                    </p>
                  </form>
                ) : null}
                {qr ? (
                  <UpiQrPayment
                    orderNumber={o.number}
                    viewToken={viewToken}
                    qr={qr}
                    amountLabel={due}
                  />
                ) : null}
                {balance ? <div className={`${CK_CARD} p-5`}>{balance}</div> : null}
                {retryButton}
                {payClient ? (
                  <a href={payPath} className={`${CK_BUTTON_PRIMARY} no-underline`}>
                    {content.payNow}
                  </a>
                ) : null}
              </div>
            )}
          </>
        )}

        {showDelivery ? (
          <div className={ENTER[2]}>
            <ThankYouDelivery
              heading={arrival ? content.delivery.arriving(arrival) : content.delivery.soon}
              body={content.delivery.body(o.shippingRateName)}
              address={deliveryAddress}
              reached={settled ? (progress.reached ?? -1) : -1}
            />
          </div>
        ) : null}

        {failed || confirming ? null : (
          <ThankYouCard
            id="order-details-heading"
            title={content.details.heading}
            className={ENTER[2]}
          >
            <OrderDetails
              order={o}
              shipTo={shipTo}
              payment={pay}
              giftCards={giftCards}
              compact={showDelivery}
            />
            <CheckoutParcels parcels={parcels} />
            {links.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-ck-line pt-5 sm:flex-row sm:flex-wrap">
                {links.map((l) => (
                  <a key={l.url} href={l.url} className={`${CK_BUTTON_SECONDARY} w-full sm:w-auto`}>
                    {l.label}
                  </a>
                ))}
              </div>
            ) : null}
          </ThankYouCard>
        )}

        {failed || confirming ? null : (
          <div className={`flex flex-col-reverse gap-3 sm:flex-row ${ENTER[2]}`}>
            {continueLink}
            {trackLink ? (
              <a
                href={trackLink.href}
                {...(trackLink.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`${CK_BUTTON_PRIMARY} min-w-0 flex-1 no-underline`}
              >
                {content.trackOrder}
                <CheckoutIcon name="chevron" className="size-[1.125rem] -rotate-90" />
              </a>
            ) : null}
          </div>
        )}
      </div>
    </CheckoutPageShell>
  )
}
