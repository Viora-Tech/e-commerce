'use client'

import CheckoutContactFields from '@/components/checkout/checkout-contact-fields'
import CheckoutOtp from '@/components/checkout/checkout-otp'
import CheckoutQuickSignIn from '@/components/checkout/checkout-quick-sign-in'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_SECONDARY, CK_LINK } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutContactProps = { ck: CheckoutFormModel }

const otp = content.otp

/**
 * Contact at the top of Address. Signed in: their details (email locked when the account has
 * one). Otherwise a code to the mobile number first, the store's quick ways in, and, when
 * Settings → Customer accounts allows guests, "Check out as guest" for the plain fields.
 */
export default function CheckoutContact({ ck }: CheckoutContactProps) {
  // Render logic
  const { customer, signIn, accountRequired, settings } = ck
  const fields = (
    <CheckoutContactFields
      values={ck.form}
      errors={ck.shownErrors}
      customer={customer}
      emailOptional={settings.email === 'optional'}
      onField={ck.set}
      onPhone={ck.handlePhone}
      onLeave={ck.handleLeave}
    />
  )

  // Early returns
  if (customer) return fields
  if (ck.guest && !accountRequired) {
    return (
      <div className="flex flex-col gap-4">
        {fields}
        <button type="button" onClick={() => ck.handleGuest(false)} className={`${CK_LINK} w-fit`}>
          {otp.signInInstead}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <CheckoutOtp
        phone={ck.form.phone}
        email={ck.form.email}
        methods={signIn.methods}
        onPhone={ck.handlePhone}
        onEmail={ck.set('email')}
        note={accountRequired ? otp.required : otp.optional}
      />
      {signIn.options ? <CheckoutQuickSignIn options={signIn.options} /> : null}
      {accountRequired ? null : (
        <button
          type="button"
          onClick={() => ck.handleGuest(true)}
          className={`${CK_BUTTON_SECONDARY} w-full`}
        >
          {otp.guest}
        </button>
      )}
    </div>
  )
}
