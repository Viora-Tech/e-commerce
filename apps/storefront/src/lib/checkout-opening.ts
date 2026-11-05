import { cleanPostalCode } from '@commerce/core/checkout-address'
import {
  addressForCountry,
  type CheckoutFormState,
  fullNameOf,
  phoneForCountry,
} from '@/lib/checkout-form-state'
import type { RememberedDetails } from '@/lib/checkout-remember'
import { cleanPincode } from '@/lib/checkout-validation'

/** This tab's draft as the form it reopens: a signed-in email wins, and the pick must be on offer. */
export function openFromDraft(
  draft: CheckoutFormState,
  form: CheckoutFormState,
  {
    email,
    countryCode,
    payments,
  }: { email?: string | null | undefined; countryCode: string; payments: string[] },
): CheckoutFormState {
  return {
    ...draft,
    countryCode,
    email: email ?? draft.email,
    payment: payments.includes(draft.payment) ? draft.payment : form.payment,
  }
}

/** A guest's last details. An address in a country the store no longer ships to starts over. */
export function openFromRemembered(
  remembered: RememberedDetails,
  form: CheckoutFormState,
  country: string,
): CheckoutFormState {
  return country === (remembered.countryCode ?? 'IN')
    ? { ...form, ...remembered, countryCode: country }
    : { ...form, ...remembered, ...addressForCountry(country) }
}

/** The form as the order action takes it. Settings → Checkout can split the name (#154). */
export function orderDetails(
  form: CheckoutFormState,
  { splitName, abroad }: { splitName: boolean; abroad: boolean },
) {
  const { label, lastName, ...details } = form
  return {
    ...details,
    ...(label ? { label } : {}),
    ...(splitName
      ? { name: fullNameOf(form), firstName: form.name, lastName: lastName ?? '' }
      : {}),
    pincode: abroad ? cleanPostalCode(form.pincode) : cleanPincode(form.pincode),
  }
}

/** "Use a new address" keeps who is ordering and opens in the market's country. */
export function newAddressForm<Blank extends object>(
  blank: Blank,
  form: CheckoutFormState,
  { splitName, country }: { splitName: boolean; country: string },
) {
  return {
    ...blank,
    name: form.name,
    ...(splitName ? { lastName: form.lastName ?? '' } : {}),
    phone: phoneForCountry(form.phone, country),
  }
}

/** Off cash on delivery, to the first online method, when it cannot take this order. */
export const offCod = (form: CheckoutFormState, methods: { id: string }[]): CheckoutFormState =>
  form.payment === 'cod'
    ? { ...form, payment: methods.find((m) => m.id !== 'cod')?.id ?? form.payment }
    : form
