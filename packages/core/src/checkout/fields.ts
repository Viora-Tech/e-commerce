/** SOURCE OF TRUTH: checkout field rules — WHAT: Settings → Checkout → Form fields (#154): the name as one field or first + last, the company name hidden, optional or required, and address line 2 hidden, optional or required, with the pure check the storefront form and `placeOrder` both run / WHY: GST buyers need a company name, some couriers need a landmark, and the server must refuse what the form would have refused */
import { z } from 'zod'

export const NAME_FORMATS = ['full', 'split'] as const
export type NameFormat = (typeof NAME_FORMATS)[number]

export const FIELD_REQUIREMENTS = ['hidden', 'optional', 'required'] as const
export type FieldRequirement = (typeof FIELD_REQUIREMENTS)[number]

export const CheckoutFieldsSchema = z.object({
  /** `full`: one "Full name" field. `split`: first name and last name, both required. */
  name: z.enum(NAME_FORMATS).default('full'),
  /**
   * The company name in the Delivery card. `hidden` keeps the old behaviour: a business name
   * only next to a GSTIN, under "Get a GST invoice".
   */
  company: z.enum(FIELD_REQUIREMENTS).default('hidden'),
  /** The landmark / second address line. */
  line2: z.enum(FIELD_REQUIREMENTS).default('optional'),
})
export type CheckoutFields = z.infer<typeof CheckoutFieldsSchema>

export const defaultCheckoutFields: CheckoutFields = CheckoutFieldsSchema.parse({})

/** Longest name part and company name a shopper can type. */
const NAME_MAX = 120

export type AddressFieldInput = {
  /** The full name, or the first name when the store splits it. */
  name?: string | null | undefined
  lastName?: string | null | undefined
  line2?: string | null | undefined
  businessName?: string | null | undefined
}

export type AddressFieldErrors = Partial<
  Record<'name' | 'lastName' | 'line2' | 'businessName', string>
>

export const ADDRESS_FIELD_MESSAGES = {
  name: 'Enter your full name',
  firstName: 'Enter your first name',
  lastName: 'Enter your last name',
  line2: 'Enter a landmark or the second address line',
  businessName: 'Enter your company name',
} as const

const filled = (v: string | null | undefined) => (v ?? '').trim().length > 0

/**
 * What is missing from the name, landmark and company fields under these rules. Pure: the
 * storefront form shows it as the shopper types and `placeOrder` refuses an order with any.
 */
export function addressFieldErrors(
  fields: CheckoutFields,
  input: AddressFieldInput,
): AddressFieldErrors {
  const errors: AddressFieldErrors = {}
  if (!filled(input.name)) {
    errors.name =
      fields.name === 'split' ? ADDRESS_FIELD_MESSAGES.firstName : ADDRESS_FIELD_MESSAGES.name
  }
  if (fields.name === 'split' && !filled(input.lastName)) {
    errors.lastName = ADDRESS_FIELD_MESSAGES.lastName
  }
  if (fields.line2 === 'required' && !filled(input.line2)) {
    errors.line2 = ADDRESS_FIELD_MESSAGES.line2
  }
  if (fields.company === 'required' && !filled(input.businessName)) {
    errors.businessName = ADDRESS_FIELD_MESSAGES.businessName
  }
  return errors
}

/** The name an order and its address carry: first and last joined when the store splits it. */
export function joinedName(fields: Pick<CheckoutFields, 'name'>, input: AddressFieldInput): string {
  const first = (input.name ?? '').trim()
  if (fields.name !== 'split') return first.slice(0, NAME_MAX * 2)
  return [first, (input.lastName ?? '').trim()]
    .filter(Boolean)
    .join(' ')
    .slice(0, NAME_MAX * 2)
}

/**
 * A saved full name split for the first + last fields: the last word is the last name.
 * "Asha" stays a first name with no last name (the form then asks for one).
 */
export function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { first: parts[0] ?? '', last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] as string }
}

/**
 * The company name an order keeps: whatever the shopper typed when the store shows the field,
 * else only alongside a valid GSTIN (the GST invoice section), as before #154.
 */
export function keptBusinessName(
  fields: Pick<CheckoutFields, 'company'>,
  input: { businessName?: string | null | undefined; hasGstin: boolean },
): string | null {
  if (fields.company === 'hidden' && !input.hasGstin) return null
  return (input.businessName ?? '').trim().slice(0, NAME_MAX) || null
}
