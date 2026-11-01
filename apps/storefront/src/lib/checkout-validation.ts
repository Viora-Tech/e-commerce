import { normaliseMobile } from '@commerce/core/accounts'
import { abroadAddressErrors, abroadPhone, isAbroad } from '@commerce/core/checkout-address'
import {
  type CheckoutFields,
  GSTIN_MESSAGES,
  stateMatchesPincode,
} from '@commerce/core/checkout-settings'
import { validateGstin } from '@commerce/core/gstin'
import { checkoutContent } from '@/data/checkout'

/*
 * The checkout form's inline checks, in the browser, as the shopper types. Pure, so it
 * is tested on its own. The server re-checks everything (`validateCheckoutContact`,
 * `placeOrder`); this only says what is wrong before the shopper presses Pay.
 */

export type CheckoutFieldKey =
  | 'email'
  | 'phone'
  | 'pincode'
  | 'name'
  | 'line1'
  | 'city'
  | 'stateCode'
  | 'gstin'
  /** Settings → Checkout → Form fields (#154): shown only when the store asks for them. */
  | 'lastName'
  | 'line2'
  | 'businessName'

type ExtraKey = 'lastName' | 'line2' | 'businessName'

export type CheckoutFieldValues = Record<Exclude<CheckoutFieldKey, ExtraKey>, string> &
  Partial<Record<ExtraKey, string>> & {
    /** The delivery country; left out means India. Abroad `stateCode` is the region. */
    countryCode?: string | undefined
  }

export type CheckoutFieldRules = {
  /** Settings → Checkout: email can be left empty. */
  emailRequired: boolean
  /** The shopper opened the business section, so a GSTIN they typed is checked. */
  gstin: boolean
  /** Settings → Checkout → Form fields; unset is one full name, line 2 optional, no company. */
  fields?: CheckoutFields | undefined
}

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldKey, string>>

const v = checkoutContent.validation
const abroadCopy = checkoutContent.abroad
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PINCODE = /^[1-9]\d{5}$/

/** "110 001" and "110-001" are typed as written; the check reads the six digits. */
export const cleanPincode = (raw: string): string => raw.replace(/[\s-]/g, '')

/** Every field that is wrong right now, with what to do about it. */
export function checkoutFieldErrors(
  values: CheckoutFieldValues,
  rules: CheckoutFieldRules,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}
  const email = values.email.trim()
  if (!email) {
    if (rules.emailRequired) errors.email = v.email
  } else if (!EMAIL.test(email)) {
    errors.email = v.emailInvalid
  }
  const country = values.countryCode ?? 'IN'
  if (isAbroad(country)) {
    // Abroad: any valid phone with its country code, a loose postcode, the region where needed.
    if (!abroadPhone(values.phone, country)) errors.phone = abroadCopy.phoneInvalid
    Object.assign(
      errors,
      abroadAddressErrors(
        { countryCode: country, stateCode: values.stateCode, pincode: values.pincode },
        {
          postcode: abroadCopy.postcodeMissing,
          postcodeInvalid: abroadCopy.postcodeInvalid,
          region: abroadCopy.regionMissing,
          regionInvalid: abroadCopy.regionInvalid,
        },
      ),
    )
  } else {
    if (!normaliseMobile(values.phone)) errors.phone = v.phone
    const pincode = cleanPincode(values.pincode)
    if (!PINCODE.test(pincode)) errors.pincode = v.pincode
    else if (!stateMatchesPincode(pincode, values.stateCode)) {
      errors.stateCode = v.stateMismatch(pincode)
    }
  }
  const split = rules.fields?.name === 'split'
  if (!values.name.trim()) errors.name = split ? v.firstName : v.name
  if (split && !(values.lastName ?? '').trim()) errors.lastName = v.lastName
  if (!values.line1.trim()) errors.line1 = v.line1
  if (rules.fields?.line2 === 'required' && !(values.line2 ?? '').trim()) {
    errors.line2 = isAbroad(country) ? abroadCopy.line2Missing : v.line2
  }
  if (rules.fields?.company === 'required' && !(values.businessName ?? '').trim()) {
    errors.businessName = v.company
  }
  if (!values.city.trim()) errors.city = v.city
  const gstin = values.gstin.trim()
  if (rules.gstin && gstin) {
    const check = validateGstin(gstin.toUpperCase())
    if (!check.ok) {
      errors.gstin =
        GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape
    }
  }
  return errors
}

/**
 * The fields in the order the form shows them, so the first wrong one gets the focus. India is
 * PIN code first; an address abroad ends with city, region and postcode.
 */
export function fieldOrder(pincodeFirst: boolean): CheckoutFieldKey[] {
  const people: CheckoutFieldKey[] = ['name', 'lastName', 'businessName', 'line1', 'line2']
  const address: CheckoutFieldKey[] = pincodeFirst
    ? ['pincode', ...people, 'city', 'stateCode']
    : [...people, 'city', 'stateCode', 'pincode']
  return ['phone', 'email', ...address, 'gstin']
}

/** The DOM id of a field's input, shared by the field and the focus-first-error step. */
export const fieldId = (key: CheckoutFieldKey): string => `checkout-${key}`
