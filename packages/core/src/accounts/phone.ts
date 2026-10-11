/** SOURCE OF TRUTH: international phone validation — WHAT: isValidPhone and normalisePhone, the E.164 form every phone field stores / WHY: the PhoneInput picker, form schemas and server checks must agree on what a phone number is */

import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { z } from 'zod'

/** Country a number without a "+" is read in; the store's shipping country. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'IN'

/**
 * "98765 43210", "09876543210", "+91 98765-43210" or "919876543210" -> "+919876543210".
 * Null when the text is not a valid number in its country.
 */
export function normalisePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const text = raw?.trim()
  if (!text) return null
  const parsed = parsePhoneNumberFromString(text, defaultCountry)
  if (parsed?.isValid()) return parsed.number
  // "919876543210" with no "+": read the leading digits as the calling code.
  if (!text.startsWith('+') && /^\d[\d\s().-]*$/.test(text)) {
    const withPlus = parsePhoneNumberFromString(`+${text.replace(/\D/g, '')}`)
    if (withPlus?.isValid()) return withPlus.number
  }
  return null
}

export const isValidPhone = (
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean => normalisePhone(raw, defaultCountry) !== null

/**
 * A phone field the API accepts as before (any text up to `max`), except that a valid number
 * is saved as E.164: "98765 43210" and "+91 98765-43210" both become "+919876543210". Text that
 * is not a valid number is kept as typed, so an old record can still be saved untouched.
 */
export const lenientPhone = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => normalisePhone(v) ?? v)
