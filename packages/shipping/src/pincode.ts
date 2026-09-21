/**
 * Indian PIN code validation. Pure - safe to import from tests, server
 * actions and the browser.
 */

/**
 * India Post PIN codes are exactly six digits and never begin with 0: the
 * leading digit is the postal region (1-8 for the eight regions, 9 reserved
 * for the Army Postal Service). Checking only `/^\d{6}$/` lets "000000" and
 * "012345" through, and both reach the courier API as a real lookup that
 * costs a request and comes back "not serviceable" - which the customer then
 * reads as "we don't deliver to you" rather than "you typed it wrong".
 */
const PINCODE_RE = /^[1-9]\d{5}$/

export type PincodeParseSuccess = {
  ok: true
  pincode: string
}

export type PincodeParseFailure = {
  ok: false
  /** Stable code for callers to branch on. */
  reason: 'missing' | 'not_six_digits' | 'leading_zero'
  /** Customer-facing wording. Deliberately free of jargon. */
  message: string
}

export type PincodeParseResult = PincodeParseSuccess | PincodeParseFailure

/**
 * Normalise and validate user input.
 *
 * Accepts the things customers actually type - spaces, a hyphen in the middle
 * ("110 001", "110-001") - because rejecting those reads as a broken form
 * rather than as a validation rule.
 */
export function parsePincode(input: unknown): PincodeParseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'missing', message: 'Enter your 6-digit PIN code.' }
  }

  const cleaned = input.replace(/[\s-]/g, '')
  if (cleaned.length === 0) {
    return { ok: false, reason: 'missing', message: 'Enter your 6-digit PIN code.' }
  }

  if (!/^\d{6}$/.test(cleaned)) {
    return {
      ok: false,
      reason: 'not_six_digits',
      message: 'A PIN code is 6 digits, like 110001.',
    }
  }

  if (!PINCODE_RE.test(cleaned)) {
    return {
      ok: false,
      reason: 'leading_zero',
      message: "That doesn't look like an Indian PIN code - none start with 0.",
    }
  }

  return { ok: true, pincode: cleaned }
}

/** Convenience predicate for settings validation and adapter guards. */
export function isValidPincode(input: unknown): input is string {
  return parsePincode(input).ok
}
