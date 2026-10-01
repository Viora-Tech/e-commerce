/** SOURCE OF TRUTH: checkout settings and rules — WHAT: Settings → Checkout (email required or optional, PIN code first, optional buyer GSTIN, order notes, minimum order value, cash on delivery limits and blocked PIN codes) stored on `store.preferences.checkout`, and the pure checks the storefront form and `placeOrder` both run / WHY: the checkout must never trust the client, so the server re-runs exactly the rules the form shows; client code needs them without a database import */
import { z } from 'zod'
import { MOBILE_PATTERN, normaliseMobile, PINCODE_PATTERN } from '../accounts/schemas'
import { CheckoutRuleViolation } from '../errors'
import { validateGstin } from '../tax/gstin'

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
  /** Smallest order (items after discount, before shipping) the store accepts; 0 means none. */
  minimumOrderPaise: z.number().int().min(0).default(0),
  cod: CodRulesSchema.prefault({}),
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

/** GSTIN messages the checkout shows, by `validateGstin` reason. */
export const GSTIN_MESSAGES = {
  shape: 'A GSTIN has 15 characters, like 06AAACW1234A1Z5',
  state: 'The first two digits are not a GST state code',
  checksum: 'This GSTIN has a typo: its last character does not match the rest',
} as const

export type CheckoutContactInput = {
  email: string
  phone: string
  gstin?: string | null | undefined
  businessName?: string | null | undefined
  note?: string | null | undefined
}

export type CheckoutContact = {
  email: string | null
  /** Ten digits, without +91. */
  phone: string
  gstin: string | null
  businessName: string | null
  note: string | null
}

export type CheckoutFieldErrors = Partial<
  Record<'email' | 'phone' | 'gstin' | 'businessName' | 'note' | 'pincode', string>
>

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
  const phone = normaliseMobile(input.phone)
  if (!phone || !MOBILE_PATTERN.test(phone)) {
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
  const businessName = gstin
    ? (input.businessName ?? '').trim().slice(0, CHECKOUT_LIMITS.businessName) || null
    : null
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
    checkout: (CheckoutContactInput & { address: { pincode: string } }) | null
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
    const checked = validateCheckoutContact(settings, order.checkout)
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
