import { z } from 'zod'
import { GSTIN_MESSAGES, validateGstin } from '../tax/gstin'
import { INDIAN_STATE_NAMES } from '../tax/states'
import { MOBILE_PATTERN, PINCODE_PATTERN } from './patterns'

/**
 * Pure validation for storefront accounts, safe to import from client components
 * (`@commerce/core/accounts`).
 */

// The patterns live in a zod-free module the storefront's address form imports in the
// browser (`@commerce/core/account-patterns`); re-exported so nothing else changes.
export { isPincode, MOBILE_PATTERN, PINCODE_PATTERN } from './patterns'

/** "+91 98765 43210" -> "9876543210"; null when it is not a mobile number. */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  const trimmed = local.length === 11 && local.startsWith('0') ? local.slice(1) : local
  return MOBILE_PATTERN.test(trimmed) ? trimmed : null
}

const text = (max: number) => z.string().trim().min(1, 'Required').max(max, 'Too long')

/** The tag on a saved address (Home, Office, Other); the database checks the same list. */
export const ADDRESS_LABELS = ['home', 'office', 'other'] as const
export type AddressLabel = (typeof ADDRESS_LABELS)[number]

/**
 * An optional GSTIN: blank is none (null), anything else must pass `validateGstin` and is
 * kept upper case. Left out (undefined) leaves a saved value alone.
 */
export const OptionalGstinSchema = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (v === undefined) return undefined
    if (v === null || v.trim() === '') return null
    const check = validateGstin(v)
    if (check.ok) return check.gstin
    ctx.addIssue({
      code: 'custom',
      message: GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape,
    })
    return null
  })

/** A company name beside a GSTIN; blank is none (null), left out keeps the saved one. */
export const OptionalBusinessNameSchema = z
  .string()
  .trim()
  .max(200, 'Too long')
  .nullish()
  .transform((v) => (v === undefined ? undefined : v || null))

export const AddressInputSchema = z.object({
  name: text(120),
  line1: text(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  city: text(80),
  stateCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v in INDIAN_STATE_NAMES, 'Unknown state'),
  pincode: z.string().trim().regex(PINCODE_PATTERN, 'Enter a six digit PIN code'),
  phone: z.string().transform((v, ctx) => {
    const m = normaliseMobile(v)
    if (!m) ctx.addIssue({ code: 'custom', message: 'Enter a ten digit mobile number' })
    return m ?? ''
  }),
  /** Left out: an edit keeps the address's tag; null clears it. */
  label: z.enum(ADDRESS_LABELS).nullable().optional(),
  /** The default shipping address. */
  isDefault: z.boolean().optional(),
  /** The default billing address; left out keeps what the address had. */
  isDefaultBilling: z.boolean().optional(),
  /** Billing details for GST invoices; left out keeps what the address had. */
  businessName: OptionalBusinessNameSchema,
  gstin: OptionalGstinSchema,
})

export type AddressInput = z.input<typeof AddressInputSchema>
export type ParsedAddress = z.output<typeof AddressInputSchema>

export const ProfileInputSchema = z.object({
  name: z.string().trim().max(120),
  phone: z.string().transform((v, ctx) => {
    if (!v.trim()) return null
    const m = normaliseMobile(v)
    if (!m) ctx.addIssue({ code: 'custom', message: 'Enter a ten digit mobile number' })
    return m
  }),
  /** Email marketing. */
  acceptsMarketing: z.boolean(),
  /** WhatsApp and SMS marketing; left as they are when the form does not show them. */
  acceptsWhatsapp: z.boolean().optional(),
  acceptsSms: z.boolean().optional(),
})

export type ProfileInput = z.input<typeof ProfileInputSchema>

/** Field errors keyed by field, from a failed parse. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}
