import { z } from 'zod'
import { INDIAN_STATE_NAMES } from '../tax/states'

/**
 * Pure validation for storefront accounts, safe to import from client components
 * (`@commerce/core/accounts`).
 */

/** Indian PIN code: six digits, never starting with 0. */
export const PINCODE_PATTERN = /^[1-9]\d{5}$/
/** Ten digit Indian mobile number, optionally written with +91 or a leading 0. */
export const MOBILE_PATTERN = /^[6-9]\d{9}$/

export const isPincode = (v: string): boolean => PINCODE_PATTERN.test(v.trim())

/** "+91 98765 43210" -> "9876543210"; null when it is not a mobile number. */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  const trimmed = local.length === 11 && local.startsWith('0') ? local.slice(1) : local
  return MOBILE_PATTERN.test(trimmed) ? trimmed : null
}

const text = (max: number) => z.string().trim().min(1, 'Required').max(max, 'Too long')

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
  isDefault: z.boolean().optional(),
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
