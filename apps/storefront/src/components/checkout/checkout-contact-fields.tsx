'use client'

import type { SignedInCustomer } from '@commerce/core'
import CheckoutField from '@/components/checkout/checkout-field'
import { accountContent } from '@/data/account'
import { checkoutContent as content } from '@/data/checkout'
import { type CheckoutFieldErrors, fieldId } from '@/lib/checkout-validation'

type ContactKey = 'email' | 'phone'

type CheckoutContactFieldsProps = {
  values: Record<ContactKey, string>
  /** Errors to show now: fields the shopper has left, or all of them after a Pay attempt. */
  errors: CheckoutFieldErrors
  customer: SignedInCustomer | null
  /** Settings → Checkout: email can be left empty. */
  emailOptional: boolean
  onField: (key: ContactKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Leaving a field: show its check, and save the contact so a left basket can be recovered. */
  onLeave: (key: ContactKey) => void
}

const f = content.fields

/** Email and mobile number. A signed-in shopper's email is theirs and not edited here. */
export default function CheckoutContactFields({
  values,
  errors,
  customer,
  emailOptional,
  onField,
  onLeave,
}: CheckoutContactFieldsProps) {
  // Render logic
  const lockedEmail = Boolean(customer?.email)

  return (
    <div className="flex flex-col gap-4">
      {customer ? (
        <p className="text-[0.875rem] text-ck-muted">
          {accountContent.checkout.signedInAs(customer.email ?? customer.phone ?? '')}
        </p>
      ) : null}
      <CheckoutField
        id={fieldId('email')}
        label={emailOptional && !lockedEmail ? f.emailOptional : f.email}
        type="email"
        inputMode="email"
        required={!emailOptional || lockedEmail}
        autoComplete="email"
        placeholder={f.emailPlaceholder}
        value={values.email}
        onChange={onField('email')}
        onBlur={() => onLeave('email')}
        readOnly={lockedEmail}
        error={errors.email}
      />
      <CheckoutField
        id={fieldId('phone')}
        label={f.phone}
        type="tel"
        inputMode="tel"
        required
        autoComplete="tel-national"
        prefix={f.phonePrefix}
        placeholder={f.phonePlaceholder}
        maxLength={16}
        value={values.phone}
        onChange={onField('phone')}
        onBlur={() => onLeave('phone')}
        error={errors.phone}
        hint={f.phoneHint}
      />
    </div>
  )
}
