import type { SavedAddress, SignedInCustomer } from '@commerce/core'
import { isAbroad } from '@commerce/core/checkout-address'
import { type NameFormat, splitFullName } from '@commerce/core/checkout-settings'
import type { CheckoutForm } from '@/lib/cart-actions'

/** Everything the checkout form holds; the action's fields plus the optional extras. */
export type CheckoutFormState = CheckoutForm & {
  /** The Country picker; `IN` keeps the PIN code first form. */
  countryCode: string
  gstin: string
  businessName: string
  note: string
  /** The address's tag (`ADDRESS_LABELS`), or '' for none. */
  label: string
  /**
   * Settings → Checkout splits the name (#154): `name` then holds the first name and this the
   * last. Unset (and unused) for one full name.
   */
  lastName?: string
}

const EMPTY_FORM: Omit<CheckoutFormState, 'payment'> = {
  name: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
  countryCode: 'IN',
  gstin: '',
  businessName: '',
  note: '',
  label: '',
}

/** The address book's "Use a new address" choice. */
export const NEW_ADDRESS = 'new'

/** The form's address fields for a new country: empty, with India's default state back home. */
export function addressForCountry(
  countryCode: string,
): Pick<CheckoutFormState, 'countryCode' | 'stateCode' | 'pincode' | 'city'> {
  return {
    countryCode,
    stateCode: isAbroad(countryCode) ? '' : EMPTY_FORM.stateCode,
    pincode: '',
    city: '',
  }
}

/**
 * The phone as the field for `countryCode` reads it. India's field holds the ten digits; abroad
 * it holds the number with its country code, so a saved Indian number gains its +91 there
 * instead of being read as a number of the new country (+971 98765…), and loses it back home.
 */
export function phoneForCountry(phone: string, countryCode: string): string {
  const digits = phone.replace(/[\s-]/g, '')
  if (isAbroad(countryCode)) return /^\d{10}$/.test(digits) ? `+91${digits}` : phone
  return /^\+91\d{10}$/.test(digits) ? digits.slice(3) : phone
}

/**
 * Contact and address fields from the account, so a returning shopper types nothing. Saved
 * addresses are Indian (the address book takes PIN codes); a new address opens in `country`.
 */
export function prefillCheckout(
  customer: SignedInCustomer | null,
  address: SavedAddress | undefined,
  nameFormat: NameFormat = 'full',
  country = 'IN',
): Omit<CheckoutFormState, 'payment'> {
  const fullName = address?.name ?? customer?.name ?? ''
  const parts = nameFormat === 'split' ? splitFullName(fullName) : null
  return {
    ...EMPTY_FORM,
    ...(address ? {} : addressForCountry(country)),
    name: parts ? parts.first : fullName,
    ...(parts ? { lastName: parts.last } : {}),
    email: customer?.email ?? '',
    phone: phoneForCountry(address?.phone ?? customer?.phone ?? '', address ? 'IN' : country),
    ...(address
      ? {
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          stateCode: address.stateCode,
          pincode: address.pincode,
          countryCode: 'IN',
          label: address.label ?? '',
        }
      : {}),
  }
}

/** The order's full name: the first and last name joined when the store splits it. */
export function fullNameOf(form: Pick<CheckoutFormState, 'name' | 'lastName'>): string {
  return [form.name.trim(), (form.lastName ?? '').trim()].filter(Boolean).join(' ')
}
