'use client'

import { CHECKOUT_LIMITS } from '@commerce/core/checkout-settings'
import PaymentMethods from '@/components/checkout/payment-methods'
import { checkoutContent as content } from '@/data/checkout'
import { CK_INPUT, CK_LABEL } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutPaymentStepProps = { ck: CheckoutFormModel }

/**
 * The last step (Figma Checkout / Payment): the ways to pay as one list (UPI first, cash on
 * delivery last), the picked one opening onto what happens next, and the order note when the
 * store takes one. Paying opens the provider's own window or the UPI QR, as before.
 */
export default function CheckoutPaymentStep({ ck }: CheckoutPaymentStepProps) {
  // Render logic
  const { totals } = ck

  return (
    <div className="flex flex-col gap-6">
      {totals.coveredByCards ? (
        <p className="rounded-ck border border-ck-line bg-ck-field px-4 py-3 text-[0.875rem] text-ck-ink">
          {content.paidByGiftCard}
        </p>
      ) : (
        <PaymentMethods
          methods={totals.offered}
          selected={totals.payment}
          codBlocked={totals.codBlocked}
          codNote={totals.codNote}
          onSelect={ck.handlePayment}
        />
      )}
      {ck.settings.orderNotes ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-note" className={CK_LABEL}>
            {content.fields.note}
          </label>
          <textarea
            id="checkout-note"
            className={`${CK_INPUT} min-h-[5.5rem] resize-y py-3`}
            rows={3}
            maxLength={CHECKOUT_LIMITS.note}
            placeholder={content.fields.notePlaceholder}
            value={ck.form.note}
            onChange={ck.set('note')}
          />
        </div>
      ) : null}
    </div>
  )
}
