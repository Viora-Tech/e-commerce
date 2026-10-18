'use client'

import CheckoutAddressBook from '@/components/checkout/checkout-address-book'
import ExpressPay from '@/components/checkout/express-pay'
import { checkoutContent as content } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutAddressStepProps = { ck: CheckoutFormModel }

const SUBHEADING = `${CK_HEADING} text-[1rem]!`

/**
 * Figma Checkout / Address (488:5579): express UPI at the top (the shopper is known by now),
 * then where the order goes, from the address book or new.
 */
export default function CheckoutAddressStep({ ck }: CheckoutAddressStepProps) {
  // Render logic
  const { totals, contactReady } = ck
  const shortfall = ck.shortfall > 0
  const savedCards = ck.customer !== null && ck.addresses.length > 0 && !totals.digitalOnly

  return (
    <div className="flex flex-col gap-8">
      {contactReady && ck.upi && !totals.coveredByCards ? (
        <ExpressPay
          amountLabel={ck.payNow}
          pending={ck.pending}
          disabled={ck.updating || ck.unserviceable || shortfall}
          message={ck.expressNote}
          onPay={ck.handleExpress}
        />
      ) : null}

      {contactReady ? (
        <section aria-labelledby="checkout-address-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 id="checkout-address-title" className={SUBHEADING}>
              {totals.digitalOnly ? content.giftCardAddress : content.steps.addressHeading}
            </h3>
            {savedCards ? (
              <p className="text-[0.875rem] text-ck-muted">{content.addressBook.intro}</p>
            ) : null}
          </div>
          <CheckoutAddressBook ck={ck} />
        </section>
      ) : null}
    </div>
  )
}
