'use client'

import CheckoutContactFields from '@/components/checkout/checkout-contact-fields'
import CheckoutOtp from '@/components/checkout/checkout-otp'
import CheckoutQuickSignIn from '@/components/checkout/checkout-quick-sign-in'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_SECONDARY } from '@/lib/checkout-classes'
import type { CheckoutFormModel } from '@/lib/use-checkout-form'

type CheckoutContactProps = { ck: CheckoutFormModel }

const otp = content.otp

/**
 * The Contact card's body. Signed in: their details (email locked when the account has one).
 * A guest (the default when Settings → Customer accounts allows guests): the mobile number
 * and the email, with "Sign in" in the card's heading. Signing in, or a store that needs an
 * account: a code to the mobile number, the store's quick ways in, and, when guests are
 * allowed, a way back to the plain fields.
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
      copy={ck.copy}
      onField={ck.set}
      onPhone={ck.handlePhone}
      onLeave={ck.handleLeave}
      countryCode={ck.form.countryCode}
    />
  )

  // Shopify asks for email and SMS; here email and WhatsApp, both unticked (audit #153).
  const optIn = (
    <div className="flex flex-col gap-2 pt-1">
      {(['email', 'whatsapp'] as const).map((channel) => (
        <label
          key={channel}
          className="flex w-fit cursor-pointer items-center gap-2 text-[0.8125rem] text-ck-ink/85"
        >
          <input
            type="checkbox"
            checked={Boolean(ck.form.marketing?.[channel])}
            onChange={(e) => ck.handleMarketing(channel, e.target.checked)}
            className="size-4 cursor-pointer rounded accent-[var(--ck-accent)]"
          />
          {content.marketing[channel]}
        </label>
      ))}
    </div>
  )
  const withOptIn = (
    <div className="flex flex-col gap-3">
      {fields}
      {optIn}
    </div>
  )

  // Early returns
  if (customer) return withOptIn
  // A guest's "Sign in" sits in the card's heading (`CheckoutForm`).
  if (ck.guest && !accountRequired) return withOptIn

  return (
    <div className="flex flex-col gap-4">
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
