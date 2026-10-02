import { normaliseMobile } from '@commerce/core/accounts'
import { GSTIN_MESSAGES, stateMatchesPincode } from '@commerce/core/checkout-settings'
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

export type CheckoutFieldValues = Record<CheckoutFieldKey, string>

export type CheckoutFieldRules = {
  /** Settings → Checkout: email can be left empty. */
  emailRequired: boolean
  /** The shopper opened the business section, so a GSTIN they typed is checked. */
  gstin: boolean
}

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldKey, string>>

const v = checkoutContent.validation
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
  if (!normaliseMobile(values.phone)) errors.phone = v.phone
  const pincode = cleanPincode(values.pincode)
  if (!PINCODE.test(pincode)) errors.pincode = v.pincode
  else if (!stateMatchesPincode(pincode, values.stateCode)) {
    errors.stateCode = v.stateMismatch(pincode)
  }
  if (!values.name.trim()) errors.name = v.name
  if (!values.line1.trim()) errors.line1 = v.line1
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

/** The fields in the order the form shows them, so the first wrong one gets the focus. */
export function fieldOrder(pincodeFirst: boolean): CheckoutFieldKey[] {
  const address: CheckoutFieldKey[] = pincodeFirst
    ? ['pincode', 'name', 'line1', 'city', 'stateCode']
    : ['name', 'line1', 'city', 'stateCode', 'pincode']
  return ['email', 'phone', ...address, 'gstin']
}

/** The DOM id of a field's input, shared by the field and the focus-first-error step. */
export const fieldId = (key: CheckoutFieldKey): string => `checkout-${key}`
