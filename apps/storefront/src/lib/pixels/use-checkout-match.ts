import type { CustomerFacts } from '@commerce/core/pixels'
import { useEffect } from 'react'
import { type CheckoutFormState, fullNameOf } from '@/lib/checkout-form-state'
import { reportShopperFacts } from './match'

type CheckoutContact = Pick<
  CheckoutFormState,
  'email' | 'phone' | 'name' | 'lastName' | 'city' | 'stateCode' | 'pincode' | 'countryCode'
>

/**
 * What checkout knows for the browser pixel's advanced matching. Nothing until the shopper has
 * typed an email or phone, and the state only once a PIN code is in: before that it is the
 * form's default, not the shopper's.
 */
export function checkoutMatchFacts(
  form: CheckoutContact,
  customerId: string | null | undefined,
): CustomerFacts | null {
  const hasContact = form.email.includes('@') || form.phone.replace(/\D/g, '').length >= 10
  if (!hasContact) return null
  const placed = form.pincode.trim().length > 0
  return {
    email: form.email,
    phone: form.phone,
    name: fullNameOf(form),
    city: form.city,
    state: placed ? form.stateCode : null,
    pincode: form.pincode,
    country: form.countryCode,
    externalId: customerId,
  }
}

/**
 * Checkout reports the contact and address as typed. Hashed and handed to the pixels only by
 * the listener mounted after a yes to marketing (`PixelEvents`); without it nothing happens.
 */
export function useCheckoutMatch(form: CheckoutContact, customerId: string | null | undefined) {
  const facts = checkoutMatchFacts(form, customerId)
  const key = JSON.stringify(facts)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `facts`.
  useEffect(() => {
    if (facts) reportShopperFacts(facts)
  }, [key])
}
