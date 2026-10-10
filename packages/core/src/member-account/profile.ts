/** SOURCE OF TRUTH: member profile, member phone — WHAT: the rules for a team member's own name and the E.164 mobile their WhatsApp alerts go to (Account → Profile) / WHY: one rule for the admin form and the API, so the two never disagree about a valid number; pure and client-safe (`@commerce/core/member-account`) */
import { z } from 'zod'

export const MEMBER_NAME_MAX = 80

/**
 * A phone number as E.164, India by default: "98046 82471", "098046 82471" and
 * "+91 98046 82471" all become "+919804682471". A number written with "+" and another
 * country code is kept (8 to 15 digits). Null when it cannot be a mobile number; an
 * empty value is not an error (the field is optional) and returns "".
 */
export function normaliseMemberPhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/[^\d\s()+.-]/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  const indian = (local: string) => (/^[6-9]\d{9}$/.test(local) ? `+91${local}` : null)
  if (trimmed.startsWith('+')) {
    if (digits.startsWith('91')) return indian(digits.slice(2))
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0')
      ? `+${digits}`
      : null
  }
  if (digits.length === 10) return indian(digits)
  if (digits.length === 11 && digits.startsWith('0')) return indian(digits.slice(1))
  if (digits.length === 12 && digits.startsWith('91')) return indian(digits.slice(2))
  return null
}

/** What Account → Profile saves. The phone arrives as typed and leaves as E.164 or null. */
export const MemberProfileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(MEMBER_NAME_MAX, `Keep your name under ${MEMBER_NAME_MAX} letters`),
  phone: z
    .string()
    .max(32)
    .transform((value, ctx) => {
      const phone = normaliseMemberPhone(value)
      if (phone === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number' })
        return z.NEVER
      }
      return phone === '' ? null : phone
    }),
})

export type MemberProfileInput = z.input<typeof MemberProfileInputSchema>
