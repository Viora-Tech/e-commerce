'use client'

import { trackCommerce, useFormatPaise, useMarketPricing } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import { CHECKOUT_LIMITS } from '@commerce/core/checkout-settings'
import { addPaymentInfoEventId } from '@commerce/core/pixels'
import CheckoutGstFields from '@/components/checkout/checkout-gst-fields'
import PaymentMethods from '@/components/checkout/payment-methods'
import { checkoutContent as content } from '@/data/checkout'
import { CK_INPUT, CK_LABEL } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutPaymentStepProps = { ck: CheckoutFormModel }

/** AddPaymentInfo ids already reported in this tab: one per cart and way to pay. */
const reported = new Set<string>()

/**
 * Pixels app: the shopper picked a way to pay. Sent like InitiateCheckout (cart value, variant
 * ids), and only after a yes to marketing (the listener's rule); picking a method again is not
 * a new event, picking another one is.
 */
function trackPaymentInfo(cart: CartView, methodId: string): void {
  const eventId = addPaymentInfoEventId(cart.id, methodId)
  if (reported.has(eventId)) return
  reported.add(eventId)
  trackCommerce({
    name: 'AddPaymentInfo',
    eventId,
    valuePaise: cart.subtotalPaise,
    contentIds: cart.lines.map((l) => l.variantId),
    numItems: cart.lines.reduce((n, l) => n + l.quantity, 0),
  })
}

/**
 * The Payment card's body (design): the ways to pay as radio cards (UPI first, cash on
 * delivery last), the picked one opening onto what happens next, the order note when the
 * store takes one, and "Get a GST invoice" when Settings → Checkout allows a GSTIN. Paying
 * opens the provider's own window or the UPI QR, as before.
 */
export default function CheckoutPaymentStep({ ck }: CheckoutPaymentStepProps) {
  // Hooks
  // A market in another currency: Pay charges rupees, said here beside the ways to pay too,
  // since a phone keeps the summary (and its note) folded away.
  const money = useFormatPaise()
  const pricing = useMarketPricing()

  // Event handlers
  const handleSelect = (id: string) => {
    ck.handlePayment(id)
    trackPaymentInfo(ck.cart, id)
  }

  // Render logic
  const { totals } = ck

  return (
    <div className="flex flex-col gap-4">
      {pricing && !totals.coveredByCards ? (
        <p className="rounded-ck border border-ck-line bg-ck-canvas px-4 py-3 text-[0.8125rem] text-ck-ink">
          {content.chargedInRupees(ck.payNow, money(totals.payNowPaise))}
        </p>
      ) : null}
      {totals.coveredByCards ? (
        <p className="rounded-ck border border-ck-line bg-ck-canvas px-4 py-3 text-[0.875rem] text-ck-ink">
          {content.paidByGiftCard}
        </p>
      ) : totals.offered.length === 0 ? (
        // Every way to pay is hidden for this order (Settings → Payments → customizations).
        <p
          role="alert"
          className="rounded-ck border border-ck-line bg-ck-canvas px-4 py-3 text-[0.875rem] text-ck-ink"
        >
          {content.noWayToPay}
        </p>
      ) : (
        <PaymentMethods
          methods={totals.offered}
          selected={totals.payment}
          codBlocked={totals.codBlocked}
          codNote={totals.codNote}
          amountLabel={ck.payNow}
          onSelect={handleSelect}
        />
      )}
      {ck.settings.orderNotes ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-note" className={CK_LABEL}>
            {ck.copy.fields.note}
          </label>
          <textarea
            id="checkout-note"
            className={`${CK_INPUT} min-h-[5.5rem] resize-y py-3`}
            rows={3}
            maxLength={CHECKOUT_LIMITS.note}
            placeholder={ck.copy.fields.notePlaceholder}
            value={ck.form.note}
            onChange={ck.set('note')}
          />
        </div>
      ) : null}
      {ck.settings.gstin ? (
        <CheckoutGstFields
          values={ck.form}
          errors={ck.shownErrors}
          business={ck.business}
          companyShown={ck.settings.fields.company !== 'hidden'}
          copy={ck.copy}
          onBusiness={ck.handleBusiness}
          onField={ck.set}
          onLeave={ck.handleLeave}
        />
      ) : null}
    </div>
  )
}
