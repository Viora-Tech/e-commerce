'use client'

import type { SignedInCustomer } from '@commerce/core'
import CheckoutField from '@/components/checkout/checkout-field'
import { accountContent } from '@/data/account'
import { checkoutContent as content } from '@/data/checkout'

type ContactKey = 'name' | 'email' | 'phone' | 'gstin' | 'businessName'

type CheckoutContactFieldsProps = {
  values: Record<ContactKey, string>
  customer: SignedInCustomer | null
  /** Settings → Checkout: email can be left empty. */
  emailOptional: boolean
  /** Settings → Checkout: business buyers can add a GSTIN. */
  gstinEnabled: boolean
  onField: (key: ContactKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onContactBlur: () => void
}

const f = content.fields
const accountCopy = accountContent.checkout

/** Name, email and mobile number, plus the optional GSTIN for business buyers. */
export default function CheckoutContactFields({
  values,
  customer,
  emailOptional,
  gstinEnabled,
  onField,
  onContactBlur,
}: CheckoutContactFieldsProps) {
  return (
    <fieldset className="checkout__group">
      <legend className="h4">{content.contact}</legend>
      {customer ? (
        <p className="text-small text-muted">{accountCopy.signedInAs(customer.email)}</p>
      ) : (
        <a
          href="/account/login?return_to=%2Fcheckout"
          className="text-small underline underline-offset-4"
        >
          {accountCopy.signIn}
        </a>
      )}
      <CheckoutField
        label={f.name}
        required
        autoComplete="name"
        value={values.name}
        onChange={onField('name')}
      />
      <CheckoutField
        label={emailOptional && !customer ? f.emailOptional : f.email}
        type="email"
        required={!emailOptional || customer !== null}
        autoComplete="email"
        value={values.email}
        onChange={onField('email')}
        onBlur={onContactBlur}
        readOnly={customer !== null}
      />
      <CheckoutField
        label={f.phone}
        type="tel"
        required
        pattern="[+0-9 \-]{10,16}"
        autoComplete="tel"
        value={values.phone}
        onChange={onField('phone')}
        onBlur={onContactBlur}
      />
      <p className="text-small text-muted">{f.phoneHint}</p>
      {gstinEnabled ? (
        <details className="checkout__business" open={values.gstin !== ''}>
          <summary className="text-small underline underline-offset-4">{content.business}</summary>
          <CheckoutField
            label={f.gstin}
            autoComplete="off"
            pattern="[0-9A-Za-z]{15}"
            value={values.gstin}
            onChange={onField('gstin')}
          />
          <p className="text-small text-muted">{f.gstinHint}</p>
          <CheckoutField
            label={f.businessName}
            autoComplete="organization"
            value={values.businessName}
            onChange={onField('businessName')}
          />
        </details>
      ) : null}
    </fieldset>
  )
}
