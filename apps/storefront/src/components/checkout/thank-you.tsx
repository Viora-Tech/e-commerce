import { formatPaise } from '@commerce/blocks'
import type { CheckoutLook } from '@commerce/core'
import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import type { address, order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import CheckoutShell from '@/components/checkout/checkout-shell'
import OrderDetails from '@/components/checkout/order-details'
import OrderSummary from '@/components/checkout/order-summary'
import StatusMark from '@/components/checkout/status-mark'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import TransferInstructions from '@/components/checkout/transfer-instructions'
import UpiQrPayment from '@/components/checkout/upi-qr-payment'
import { thankYouContent as content } from '@/data/checkout'
import { retryPaymentAction } from '@/lib/cart-actions'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_HEADING } from '@/lib/checkout-classes'
import type { ShopperParcel } from '@/lib/parcels'

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
}

/** Attempts still waiting on the shopper or the gateway. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(OPEN_ATTEMPT_STATUSES)

function statusLine(
  method: string | null,
  awaiting: boolean,
  manual: boolean,
  total: string,
  failed: boolean,
  qr: boolean,
): string {
  if (method === 'gift_card') return content.status.giftCard
  if (failed) return content.status.failed(total)
  if (manual) return content.status.manual
  if (qr) return content.status.upiQr(total)
  if (method === 'cod') return content.status.cod(total)
  if (awaiting) return content.status.awaiting(total)
  return content.status.paid(total)
}

/**
 * The thank-you page, in the checkout's own look: a calm mark and one headline, the
 * status in plain words, then whatever the shopper still has to do (scan the UPI QR,
 * make the transfer, pay a pre-order balance, retry a failed payment).
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
  const status = statusLine(o.paymentMethod, awaiting, manual !== null, due, failed, qr !== null)
  const boughtCards = lines.length > 0 && lines.every((l) => l.giftCard)
  const tone = failed ? 'failed' : awaiting ? 'pending' : 'success'
  const headline = failed
    ? content.headline.failed
    : awaiting
      ? content.headline.pending
      : o.paymentMethod === 'cod'
        ? content.headline.cod
        : content.headline.confirmed

  return (
    <CheckoutShell
      look={look}
      backHref="/"
      backLabel={content.continueShopping}
      summary={
        <SummaryDisclosure totalLabel={formatPaise(o.totalPaise)}>
          <OrderSummary order={o} lines={lines} images={images} giftCards={giftCards} />
        </SummaryDisclosure>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <StatusMark tone={tone} />
          <div className="flex flex-col gap-2">
            <p className="text-[0.875rem] font-medium text-ck-muted">
              {content.orderNumber(o.number)}
            </p>
            <h1 className={`${CK_HEADING} text-[1.75rem]! sm:text-[2rem]!`}>{headline}</h1>
            <p className="text-[1rem] leading-relaxed text-ck-muted">{status}</p>
          </div>
        </div>

        {manual ? <TransferInstructions instructions={manual} amountLabel={due} /> : null}
        {qr ? (
          <UpiQrPayment orderNumber={o.number} viewToken={viewToken} qr={qr} amountLabel={due} />
        ) : null}
        {balance}
        {failed || notStarted || (awaiting && session?.kind === 'client') ? (
          <div className="flex flex-col gap-3">
            {failed || notStarted ? (
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
            {awaiting && session?.kind === 'client' ? (
              <a href={payPath} className={`${CK_BUTTON_PRIMARY} no-underline`}>
                {content.payNow}
              </a>
            ) : null}
          </div>
        ) : null}

        <p className="flex items-start gap-2.5 rounded-ck bg-ck-soft px-4 py-3 text-[0.875rem] text-ck-ink">
          <CheckoutIcon name="mail" className="mt-0.5! size-4 text-ck-muted" />
          {boughtCards ? content.status.giftCardEmail(o.email) : content.confirmation(o.email)}
        </p>

        <OrderDetails order={o} shipTo={shipTo} />
        <CheckoutParcels parcels={parcels} />

        <div className="flex flex-col gap-3">
          {links.map((l) => (
            <a key={l.url} href={l.url} className={`${CK_BUTTON_SECONDARY} w-full`}>
              {l.label}
            </a>
          ))}
          <a href="/" className={`${CK_BUTTON_SECONDARY} w-full`}>
            {content.continueShopping}
          </a>
        </div>
      </div>
    </CheckoutShell>
  )
}
