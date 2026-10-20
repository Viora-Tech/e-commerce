import { createHmac } from 'node:crypto'
import { safeEqual } from '@commerce/payments'

/**
 * Constant-time string comparison for courier webhook secrets and signatures. The one
 * implementation is `safeEqual` in `@commerce/payments`; this keeps the courier-facing
 * name so every courier adapter (Delhivery, Shiprocket, ...) imports it from its own
 * contract package instead of hand-rolling `!==`.
 */
export const timingSafeEqualString: (a: string, b: string) => boolean = safeEqual

/**
 * Whether `provided` is the HMAC-SHA256 of `rawBody` under `secret`. Couriers disagree on the
 * encoding (Xpressbees sends base64, others hex, some with a `sha256=` prefix), so both
 * encodings are accepted; either one still needs the secret to produce. Constant-time.
 */
export function hmacSha256Matches(rawBody: string, secret: string, provided: string): boolean {
  const got = provided.trim().replace(/^sha256[=:]\s*/i, '')
  if (!got || !secret) return false
  const mac = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  return safeEqual(got.toLowerCase(), mac.toString('hex')) || safeEqual(got, mac.toString('base64'))
}

/** The first of `names` present in a lower-cased header map, trimmed; '' when none is. */
export function firstHeader(
  headers: Record<string, string | undefined>,
  names: readonly string[],
): string {
  for (const name of names) {
    const value = headers[name]?.trim()
    if (value) return value
  }
  return ''
}
