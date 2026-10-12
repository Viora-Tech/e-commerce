'use client'

import CheckoutAddressFields from '@/components/checkout/checkout-address-fields'
import CheckoutContactFields from '@/components/checkout/checkout-contact-fields'
import ExpressPay from '@/components/checkout/express-pay'
import { accountContent } from '@/data/account'
import { checkoutContent as content } from '@/data/checkout'
import { CK_HEADING, CK_LINK } from '@/lib/checkout-classes'
import { NEW_ADDRESS } from '@/lib/checkout-form-state'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutAddressStepProps = { ck: CheckoutFormModel }

const SUBHEADING = `${CK_HEADING} text-[1rem]!`

/**
 * Step one: express UPI at the top, then contact, then where the order goes. Signed-in
 * shoppers pick from their address book; Settings → Customer accounts decides whether a
 * guest may check out at all (the page redirects before this renders).
 */
export default function CheckoutAddressStep({ ck }: CheckoutAddressStepProps) {
  // Render logic
  const { totals, settings, customer } = ck
  const shortfall = ck.shortfall > 0

  return (
    <div className="flex flex-col gap-8">
      {ck.upi && !totals.coveredByCards ? (
        <ExpressPay
          amountLabel={ck.payNow}
          pending={ck.pending}
          disabled={ck.updating || ck.unserviceable || shortfall}
          message={ck.expressNote}
          onPay={ck.handleExpress}
        />
      ) : null}

      <section aria-labelledby="checkout-contact-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 id="checkout-contact-title" className={SUBHEADING}>
            {content.steps.contactHeading}
          </h3>
          {customer ? null : (
            <a href="/account/login?return_to=%2Fcheckout" className={CK_LINK}>
              {accountContent.checkout.signIn}
            </a>
          )}
        </div>
        <CheckoutContactFields
          values={ck.form}
          errors={ck.shownErrors}
          customer={customer}
          emailOptional={settings.email === 'optional'}
          onField={ck.set}
          onPhone={ck.handlePhone}
          onLeave={ck.handleLeave}
        />
      </section>

      <section aria-labelledby="checkout-address-title" className="flex flex-col gap-4">
        <h3 id="checkout-address-title" className={SUBHEADING}>
          {totals.digitalOnly ? content.giftCardAddress : content.steps.addressHeading}
        </h3>
        <CheckoutAddressFields
          values={ck.form}
          errors={ck.shownErrors}
          digitalOnly={totals.digitalOnly}
          pincodeFirst={settings.pincodeFirst}
          gstinEnabled={settings.gstin}
          business={ck.business}
          addresses={ck.addresses}
          savedId={ck.savedId}
          newAddressId={NEW_ADDRESS}
          deliveryText={ck.unserviceable ? null : ck.deliveryText}
          checking={ck.checking}
          onPickAddress={ck.handlePickAddress}
          onField={ck.set}
          onLeave={ck.handleLeave}
          onPincode={ck.handlePincode}
          onState={ck.handleState}
          onBusiness={ck.handleBusiness}
          onPlace={ck.handlePlace}
        />
      </section>
    </div>
  )
}
