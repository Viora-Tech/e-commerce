import { timingSafeEqual } from 'node:crypto'

/**
 * SOURCE OF TRUTH KEYWORDS: safeEqual, timingSafeEqual, constant-time compare
 * WHAT:  Constant-time string equality for signatures, webhook secrets and signed tokens.
 * WHY:   `===`/`!==` on a secret leaks how much of it a guess got right. Only the length
 *        leaks here (unequal lengths return false early, which reveals nothing useful for
 *        fixed-length MACs). One copy instead of one per gateway, courier and token module.
 * WHERE: Payment adapters (Razorpay, Cashfree, Decentro), `@commerce/shipping`'s
 *        `timingSafeEqualString`, core token modules; guarded by the duplicate-helpers sweep.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
