/** SOURCE OF TRUTH: checkout wording overrides — WHAT: Settings → Checkout → Checkout content (#158): which checkout strings a merchant may reword, per language (English, Hindi), stored per store on `preferences.checkout.content`, and the pure merge the storefront runs over its own defaults (`apps/storefront/src/data/checkout.ts`) / WHY: shops want their own words ("Mobile number for the delivery boy"), and the defaults must stay in one place */
import { z } from 'zod'

/**
 * The strings a merchant can change, as dotted paths into the storefront's `checkoutContent`.
 * Only plain text: messages with numbers or amounts in them stay ours.
 */
export const CHECKOUT_TEXT_KEYS = [
  'sections.label.contact',
  'sections.label.address',
  'sections.label.shipping',
  'sections.label.payment',
  'express.heading',
  'fields.phone',
  'fields.phoneHint',
  'fields.email',
  'fields.emailOptional',
  'fields.name',
  'fields.firstName',
  'fields.lastName',
  'fields.company',
  'fields.companyOptional',
  'fields.pincode',
  'fields.line1',
  'fields.line1Placeholder',
  'fields.line2',
  'fields.line2Required',
  'fields.city',
  'fields.state',
  'fields.note',
  'fields.notePlaceholder',
  'business',
  'summary',
  'placeOrder',
  'secure',
  'taxes',
] as const
export type CheckoutTextKey = (typeof CHECKOUT_TEXT_KEYS)[number]

const CHECKOUT_TEXT_LANGUAGES = ['en', 'hi'] as const
export type CheckoutTextLanguage = (typeof CHECKOUT_TEXT_LANGUAGES)[number]

/** Longest override; a label or a short hint, never a paragraph. */
export const CHECKOUT_TEXT_MAX = 200

const isKey = (k: string): k is CheckoutTextKey =>
  (CHECKOUT_TEXT_KEYS as readonly string[]).includes(k)

/** One language's overrides: known keys only, trimmed, blanks dropped (blank means "our default"). */
const OverridesSchema = z
  .record(z.string(), z.string().max(CHECKOUT_TEXT_MAX))
  .default({})
  .transform((raw) => {
    const out: Partial<Record<CheckoutTextKey, string>> = {}
    for (const [k, v] of Object.entries(raw)) {
      const text = v.trim()
      if (isKey(k) && text) out[k] = text
    }
    return out
  })

export const CheckoutTextSchema = z.object({
  en: OverridesSchema,
  hi: OverridesSchema,
})
export type CheckoutText = z.infer<typeof CheckoutTextSchema>
export type CheckoutTextOverrides = Partial<Record<CheckoutTextKey, string>>

/**
 * The overrides for a shopper's language. Hindi falls back key by key to the English
 * override, then to our default; any other language gets the English overrides.
 */
export function checkoutTextFor(text: CheckoutText, locale: string): CheckoutTextOverrides {
  return locale === 'hi' ? { ...text.en, ...text.hi } : { ...text.en }
}

/**
 * `base` with the overrides written over it, path by path. Pure and structure-preserving: only
 * an existing string leaf is replaced, so functions, arrays and unknown paths are left alone.
 */
export function applyCheckoutText<T extends object>(base: T, overrides: CheckoutTextOverrides): T {
  let out: T = base
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string' && isKey(key)) out = setLeaf(out, key.split('.'), value)
  }
  return out
}

function setLeaf<T>(node: T, path: string[], value: string): T {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node
  const [head, ...rest] = path as [string, ...string[]]
  const current = (node as Record<string, unknown>)[head]
  if (rest.length === 0) {
    return typeof current === 'string' ? ({ ...node, [head]: value } as T) : node
  }
  const next = setLeaf(current, rest, value)
  return next === current ? node : ({ ...node, [head]: next } as T)
}
