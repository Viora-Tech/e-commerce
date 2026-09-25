import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison for webhook secrets and signatures — same
 * pattern as `packages/payments-razorpay/src/razorpay.ts`'s `safeEqual`,
 * pulled out here so every courier adapter (Delhivery, Shiprocket, ...)
 * shares one implementation instead of each hand-rolling `!==`, which leaks
 * timing information about how much of the secret an attacker has guessed.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
