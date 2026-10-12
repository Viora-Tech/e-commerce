'use client'

import CheckoutAddressBook from '@/components/checkout/checkout-address-book'
import CheckoutContact from '@/components/checkout/checkout-contact'
import ExpressPay from '@/components/checkout/express-pay'
import { checkoutContent as content } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutAddressStepProps = { ck: CheckoutFormModel }

const SUBHEADING = `${CK_HEADING} text-[1rem]!`

/**
 * Step one: express UPI at the top (once the shopper is known), then contact (a code to the
 * mobile number first), then where the order goes. The address appears once contact is
 * settled: signed in, or a guest where Settings → Customer accounts allows one.
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

      <section aria-labelledby="checkout-contact-title" className="flex flex-col gap-4">
        <h3 id="checkout-contact-title" className={SUBHEADING}>
          {content.steps.contactHeading}
        </h3>
        <CheckoutContact ck={ck} />
      </section>

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
