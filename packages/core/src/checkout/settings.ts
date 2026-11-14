/** SOURCE OF TRUTH: checkout settings and rules — WHAT: Settings → Checkout (email required or optional, PIN code first, optional buyer GSTIN, order notes, minimum order value, cash on delivery limits and blocked PIN codes) stored on `store.preferences.checkout`, and the pure checks the storefront form and `placeOrder` both run / WHY: the checkout must never trust the client, so the server re-runs exactly the rules the form shows; client code needs them without a database import */
import { z } from 'zod'
import { MOBILE_PATTERN, normaliseMobile, PINCODE_PATTERN } from '../accounts/schemas'
import { CheckoutRuleViolation } from '../errors'
import { GSTIN_MESSAGES, validateGstin } from '../tax/gstin'
import { abroadPhone, checkoutCountry, isAbroad } from './address-abroad'
import { CheckoutBrandingSchema } from './branding'
import { CartLimitSchema } from './cart-limit'
import { CheckoutTextSchema } from './content'
import {
  type AddressFieldErrors,
  addressFieldErrors,
  CheckoutFieldsSchema,
  keptBusinessName,
} from './fields'

export * from './branding'
export * from './cart-limit'
export * from './content'
export * from './fields'
/** The browser checks the state against the PIN code as the shopper types; `placeOrder` re-checks. */
export { stateForPincode, stateMatchesPincode } from './pincode-state'

/*
 * Pure: `@commerce/core/checkout-settings`. The cash on delivery fee is not
 * here: it stays the per-method fee on `store.payments.adjustments.cod`
 * (Settings → Payments), and the Checkout page edits that same value.
 */

export const CHECKOUT_LIMITS = {
  /** Most PIN codes a merchant can block from cash on delivery. */
  blockedPincodes: 5000,
  /** Longest order note a shopper can write. */
  note: 500,
  businessName: 120,
} as const

/** The two `recommendedMethod` values that are not a way to pay. */
export const RECOMMENDED_METHOD = {
  /** The first way to pay on offer, unless that is cash on delivery (the default). */
  automatic: '',
  /** No badge at all. */
  none: 'none',
} as const

export const CodRulesSchema = z.object({
  /** Largest order value (items after discount, plus shipping) that can be paid on delivery; 0 means no limit. */
  maxOrderPaise: z.number().int().min(0).default(0),
  /** PIN codes that never get cash on delivery, sorted and unique. */
  blockedPincodes: z
    .array(z.string().regex(PINCODE_PATTERN))
    .max(CHECKOUT_LIMITS.blockedPincodes)
    .default([])
    .transform((list) => [...new Set(list)].sort()),
  /** Ask the shopper to confirm cash on delivery orders on WhatsApp. Saved now, used by a later WhatsApp flow. */
  confirmOnWhatsApp: z.boolean().default(false),
})
export type CodRules = z.infer<typeof CodRulesSchema>

export const CheckoutSettingsSchema = z.object({
  /** Mobile number is always required (couriers call it); email can be optional. */
  email: z.enum(['required', 'optional']).default('required'),
  /** Ask for the PIN code first and fill in city and state from it. */
  pincodeFirst: z.boolean().default(true),
  /** Show an optional GSTIN field so business buyers get a GST invoice with their number. */
  gstin: z.boolean().default(false),
  /** Let shoppers leave a note with their order. */
  orderNotes: z.boolean().default(false),
  /**
   * Which way to pay wears Recommended at checkout: a method id (`razorpay`, `cod`, ...),
   * `RECOMMENDED_METHOD.automatic` (empty, the first one on offer, as before the choice existed)
   * or `RECOMMENDED_METHOD.none`.
   */
  recommendedMethod: z.string().trim().max(40).default(''),
  /** Smallest order (items after discount, before shipping) the store accepts; 0 means none. */
  minimumOrderPaise: z.number().int().min(0).default(0),
  /**
   * Settings → Checkout → Order processing: a cancelled order is archived in the same step
   * (`cancelOrder`), so unpaid and voided attempts leave the working tabs. On unless the
   * merchant turned it off; archived orders stay searchable and can be unarchived.
   */
  archiveCancelled: z.boolean().default(true),
  cod: CodRulesSchema.prefault({}),
  /** Settings → Checkout → Branding: the checkout's own look, never the theme's. */
  branding: CheckoutBrandingSchema.prefault({}),
  /** Settings → Checkout → Form fields (#154): name format, company name, address line 2. */
  fields: CheckoutFieldsSchema.prefault({}),
  /** Settings → Checkout → Cart limit (#156): most units of one product per cart. */
  cartLimit: CartLimitSchema.prefault({}),
  /** Settings → Checkout → Checkout content (#158): the merchant's own wording, per language. */
  content: CheckoutTextSchema.prefault({}),
})
export type CheckoutSettings = z.infer<typeof CheckoutSettingsSchema>
export type CheckoutSettingsInput = z.input<typeof CheckoutSettingsSchema>

export const defaultCheckoutSettings: CheckoutSettings = CheckoutSettingsSchema.parse({})

/** The `checkout` key of `store.preferences`, falling back to defaults for anything missing or invalid. */
export function parseCheckoutSettings(preferences: unknown): CheckoutSettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as { checkout?: unknown }).checkout
      : undefined
  const r = CheckoutSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultCheckoutSettings
}

export type PincodeListParse = {
  /** Valid PIN codes, unique and sorted. */
  pincodes: string[]
  /** Entries that are not a PIN code, as typed, first 20 only. */
  invalid: string[]
}

/**
 * A pasted list or a CSV file of PIN codes: one per line, or separated by
 * commas, spaces or semicolons. A header row ("pincode") and quotes are
 * ignored; for a CSV with several columns, any six digit PIN code found in a
 * row counts.
 */
export function parsePincodeList(raw: string): PincodeListParse {
  const found = new Set<string>()
  const invalid: string[] = []
  for (const token of raw.split(/[\s,;\t]+/)) {
    const t = token.replace(/["']/g, '').trim()
    if (!t) continue
    if (PINCODE_PATTERN.test(t)) found.add(t)
    else if (!/^[a-z_ ]+$/i.test(t) && invalid.length < 20) invalid.push(t)
  }
  return { pincodes: [...found].sort(), invalid }
}

export type CodDecision =
  | { allowed: true }
  | { allowed: false; reason: 'blocked_pincode' | 'over_limit'; limitPaise?: number }

/**
 * Whether cash on delivery can be offered for this order. `orderValuePaise`
 * is the items after discount plus shipping, before the COD fee, so adding
 * the fee never tips an order over the limit.
 */
export function codDecision(
  rules: CodRules,
  order: { pincode: string; orderValuePaise: number },
): CodDecision {
  if (rules.blockedPincodes.includes(checkoutPincode(order.pincode) ?? order.pincode.trim())) {
    return { allowed: false, reason: 'blocked_pincode' }
  }
  if (rules.maxOrderPaise > 0 && order.orderValuePaise > rules.maxOrderPaise) {
    return { allowed: false, reason: 'over_limit', limitPaise: rules.maxOrderPaise }
  }
  return { allowed: true }
}

/** How much more the shopper must add to reach the minimum order; 0 when it is met. */
export function minimumOrderShortfall(
  settings: Pick<CheckoutSettings, 'minimumOrderPaise'>,
  subtotalAfterDiscountPaise: number,
): number {
  if (settings.minimumOrderPaise <= 0) return 0
  return Math.max(0, settings.minimumOrderPaise - subtotalAfterDiscountPaise)
}

/**
 * The amount the minimum order and the COD limit judge (security audit D-07): lines that are
 * not gift cards, less the order discount. Gift cards are prepaid vouchers, not goods that
 * ship, so they neither help reach a minimum nor push an order over the COD limit. The whole
 * discount comes off the goods (it never makes the judged amount larger), on the server and in
 * the checkout preview alike.
 */
export function checkoutRuleSubtotalPaise(
  lines: readonly { giftCard: boolean; quantity: number; unitPricePaise: number }[],
  discountPaise: number,
): number {
  const goods = lines.reduce(
    (sum, l) => (l.giftCard ? sum : sum + l.quantity * l.unitPricePaise),
    0,
  )
  return Math.max(0, goods - Math.max(0, discountPaise))
}

/** "+91 98765 43210" → "+919876543210"; null when it is not an Indian mobile number. */
export function e164IndianMobile(raw: string): string | null {
  const local = normaliseMobile(raw)
  return local ? `+91${local}` : null
}

/** GSTIN messages the checkout shows, by `validateGstin` reason (they live with the check). */
export { GSTIN_MESSAGES } from '../tax/gstin'

export type CheckoutContactInput = {
  email: string
  phone: string
  /**
   * The full name, the first and last name when the store splits it, and address line 2.
   * Checked against Settings → Checkout → Form fields only when `name` is given (#154).
   */
  name?: string | null | undefined
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  line2?: string | null | undefined
  gstin?: string | null | undefined
  businessName?: string | null | undefined
  note?: string | null | undefined
  /** The delivery country (ISO 3166-1); left out means India. Abroad any valid phone will do. */
  countryCode?: string | null | undefined
}

export type CheckoutContact = {
  email: string | null
  /** Ten digits, without +91, for an address in India; E.164 (`+61…`) for one abroad. */
  phone: string
  gstin: string | null
  businessName: string | null
  note: string | null
}

export type CheckoutFieldErrors = Partial<
  Record<'email' | 'phone' | 'gstin' | 'businessName' | 'note' | 'pincode', string>
> &
  AddressFieldErrors

/**
 * The PIN code a checkout is judged and stored by: six digits, spaces and dashes dropped.
 * Null when it is not one. Every rule (COD blocks, shipping zones) compares this form, so
 * `110-001` cannot slip past a block on `110001`.
 */
export function checkoutPincode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[\s-]/g, '')
  return PINCODE_PATTERN.test(cleaned) ? cleaned : null
}

const EMAIL = z.string().email()

/**
 * Contact fields of a checkout, checked against the store's settings. The
 * server calls this on every submit; fields the store turned off are dropped
 * rather than trusted.
 */
export function validateCheckoutContact(
  settings: CheckoutSettings,
  input: CheckoutContactInput,
): { ok: true; value: CheckoutContact } | { ok: false; errors: CheckoutFieldErrors } {
  const errors: CheckoutFieldErrors = {}
  const email = input.email.trim().toLowerCase()
  if (!email) {
    if (settings.email === 'required') errors.email = 'Enter your email address'
  } else if (!EMAIL.safeParse(email).success) {
    errors.email = 'Enter a valid email address'
  }
  const abroad = isAbroad(input.countryCode)
  const phone = abroad
    ? abroadPhone(input.phone, checkoutCountry(input.countryCode))
    : normaliseMobile(input.phone)
  if (abroad && !phone) {
    errors.phone = 'Enter a phone number with its country code, like +61 412 345 678'
  } else if (!abroad && (!phone || !MOBILE_PATTERN.test(phone))) {
    errors.phone = 'Enter a 10 digit mobile number, like 98765 43210'
  }
  let gstin: string | null = null
  const rawGstin = settings.gstin ? (input.gstin ?? '').trim().toUpperCase() : ''
  if (rawGstin) {
    const check = validateGstin(rawGstin)
    if (check.ok) gstin = check.gstin
    else {
      errors.gstin =
        GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape
    }
  }
  if (input.name !== undefined) {
    // Split names: `name` is the joined full name, the parts come alongside.
    const split = settings.fields.name === 'split' && input.firstName != null
    Object.assign(
      errors,
      addressFieldErrors(settings.fields, { ...input, name: split ? input.firstName : input.name }),
    )
  }
  const businessName = keptBusinessName(settings.fields, {
    businessName: input.businessName,
    hasGstin: gstin !== null,
  })
  const rawNote = settings.orderNotes ? (input.note ?? '').trim() : ''
  if (rawNote.length > CHECKOUT_LIMITS.note) {
    errors.note = `Keep the note under ${CHECKOUT_LIMITS.note} characters`
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      email: email || null,
      phone: phone as string,
      gstin,
      businessName,
      note: rawNote || null,
    },
  }
}

/**
 * The checks behind `enforceCheckoutRules`, without the database: throws
 * `CheckoutRuleViolation`, or returns the cleaned contact fields.
 */
export function checkCheckoutRules(
  settings: CheckoutSettings,
  order: {
    checkout:
      | (CheckoutContactInput & {
          address: {
            pincode: string
            line2?: string | undefined
            countryCode?: string | undefined
          }
        })
      | null
    paymentProviderId: string
    giftCardsOnly: boolean
    /** `checkoutRuleSubtotalPaise`: items that are not gift cards, after the discount. */
    ruleSubtotalPaise: number
    shippingPaise: number
    storeId?: string
  },
): CheckoutContact | null {
  const { storeId } = order
  let contact: CheckoutContact | null = null
  if (order.checkout) {
    const checked = validateCheckoutContact(settings, {
      ...order.checkout,
      line2: order.checkout.line2 ?? order.checkout.address.line2,
      countryCode: order.checkout.address.countryCode,
    })
    if (!checked.ok) {
      throw new CheckoutRuleViolation('contact', { storeId, fields: checked.errors })
    }
    contact = checked.value
  }
  // Gift cards are vouchers, not goods: a minimum order is about what ships.
  const shortfall = order.giftCardsOnly
    ? 0
    : minimumOrderShortfall(settings, order.ruleSubtotalPaise)
  if (shortfall > 0) {
    throw new CheckoutRuleViolation('minimum_order', { storeId, amountPaise: shortfall })
  }
  // Cash on delivery is for Indian couriers only: never an address abroad.
  if (order.paymentProviderId === 'cod' && isAbroad(order.checkout?.address.countryCode)) {
    throw new CheckoutRuleViolation('cod_abroad', { storeId })
  }
  if (order.paymentProviderId === 'cod' && order.checkout) {
    const cod = codDecision(settings.cod, {
      pincode: order.checkout.address.pincode,
      orderValuePaise: order.ruleSubtotalPaise + order.shippingPaise,
    })
    if (!cod.allowed) {
      throw new CheckoutRuleViolation(
        cod.reason === 'blocked_pincode' ? 'cod_blocked_pincode' : 'cod_over_limit',
        { storeId, ...(cod.limitPaise ? { amountPaise: cod.limitPaise } : {}) },
      )
    }
  }
  return contact
}
