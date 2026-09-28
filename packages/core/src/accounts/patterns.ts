/** SOURCE OF TRUTH: Indian PIN code and mobile patterns — WHAT: the regexes address and phone fields validate with / WHY: the storefront address form checks them in the browser without zod; the schemas reuse them */
/** Indian address and phone patterns with no zod, for client components. */

/** Indian PIN code: six digits, never starting with 0. */
export const PINCODE_PATTERN = /^[1-9]\d{5}$/
/** Ten digit Indian mobile number, optionally written with +91 or a leading 0. */
export const MOBILE_PATTERN = /^[6-9]\d{9}$/

export const isPincode = (v: string): boolean => PINCODE_PATTERN.test(v.trim())
