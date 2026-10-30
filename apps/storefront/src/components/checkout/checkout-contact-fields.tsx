'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { SignedInCustomer } from '@commerce/core'
import CheckoutField from '@/components/checkout/checkout-field'
import { accountContent } from '@/data/account'
import type { CheckoutCopy } from '@/data/checkout'
import { CK_INPUT, CK_INPUT_HEIGHT } from '@/lib/checkout-classes'
import { type CheckoutFieldErrors, fieldId } from '@/lib/checkout-validation'

type ContactKey = 'email' | 'phone'

type CheckoutContactFieldsProps = {
  values: Record<ContactKey, string>
  /** Errors to show now: fields the shopper has left, or all of them after a Pay attempt. */
  errors: CheckoutFieldErrors
  customer: SignedInCustomer | null
  /** Settings → Checkout: email can be left empty. */
  emailOptional: boolean
  /** The checkout's words, with the store's own wording over ours (#158). */
  copy: CheckoutCopy
  onField: (key: ContactKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  /** The phone picker hands over the number itself (E.164), not an input event. */
  onPhone: (value: string) => void
  /** Leaving a field: show its check, and save the contact so a left basket can be recovered. */
  onLeave: (key: ContactKey) => void
}

/** The locked checkout's box on both halves of the phone field; the picker only changes the corners. */
const PHONE_INPUT = `${CK_INPUT} ${CK_INPUT_HEIGHT} rounded-s-none!`
const PHONE_TRIGGER = `${CK_INPUT} ${CK_INPUT_HEIGHT} flex! w-auto! gap-1.5 rounded-e-none! border-e-0!`

/** Mobile number, then the email for the receipt. A signed-in shopper's email is theirs and not edited here. */
export default function CheckoutContactFields({
  values,
  errors,
  customer,
  emailOptional,
  copy,
  onField,
  onPhone,
  onLeave,
}: CheckoutContactFieldsProps) {
  // Render logic
  const f = copy.fields
  const lockedEmail = Boolean(customer?.email)

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {customer ? (
        <p className="text-[0.875rem] text-ck-muted">
          {accountContent.checkout.signedInAs(customer.email ?? customer.phone ?? '')}
        </p>
      ) : null}
      <CheckoutField
        id={fieldId('phone')}
        label={f.phone}
        error={errors.phone}
        hint={f.phoneHint}
        control={
          <PhoneInput
            id={fieldId('phone')}
            countries={['IN']}
            required
            autoComplete="tel-national"
            placeholder={f.phonePlaceholder}
            value={values.phone}
            onChange={onPhone}
            onBlur={() => onLeave('phone')}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={
              errors.phone ? `${fieldId('phone')}-error` : `${fieldId('phone')}-hint`
            }
            className="rounded-ck"
            inputClassName={PHONE_INPUT}
            triggerClassName={PHONE_TRIGGER}
          />
        }
      />
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
    </div>
  )
}
