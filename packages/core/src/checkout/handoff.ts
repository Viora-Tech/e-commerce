/** SOURCE OF TRUTH: checkout hand-off & session tokens — WHAT: signed {storeId,cartId,customerId} tokens carrying the cart/identity to the branded checkout origin (D-01 phase B) / WHY: one purpose-prefixed HMAC, two lifetimes (2-min one-shot hand-off, 2-h session), neither verifies as the other or any other token under the same secret */
import { createHmac, timingSafeEqual } from 'node:crypto'

// hand-off: minted by the store origin's /checkout/start, redeemed once by checkout.<primary>/c/<token>.
const CHECKOUT_HANDOFF_TTL_MS = 2 * 60_000
// session: what the checkout origin keeps in its host-only cookie after redemption.
const CHECKOUT_SESSION_TTL_MS = 2 * 60 * 60_000

export type CheckoutPayload = {
  storeId: string
  cartId: string
  /** The signed-in shopper carried across, or null for a guest. */
  customerId: string | null
}

type Verified =
  | (CheckoutPayload & { ok: true })
  | { ok: false; reason: 'malformed' | 'expired' | 'signature' }

const mac = (purpose: string, body: string, secret: string): string =>
  createHmac('sha256', secret).update(`${purpose}:${body}`).digest('base64url')

/** `<storeId>.<cartId>.<customerId|->.<expiresMs>.<mac>`. storeId/cartId/customerId are ids with no dots. */
function sign(
  purpose: string,
  p: CheckoutPayload,
  secret: string,
  ttlMs: number,
  now: Date,
): string {
  const body = `${p.storeId}.${p.cartId}.${p.customerId ?? '-'}.${now.getTime() + ttlMs}`
  return `${body}.${mac(purpose, body, secret)}`
}

function verify(purpose: string, token: string, secret: string, now: Date): Verified {
  const parts = token.split('.')
  if (parts.length !== 5) return { ok: false, reason: 'malformed' }
  const [storeId, cartId, customer, expires, got] = parts
  const expiresMs = Number(expires)
  if (!storeId || !cartId || !customer || !Number.isFinite(expiresMs)) {
    return { ok: false, reason: 'malformed' }
  }
  const body = `${storeId}.${cartId}.${customer}.${expires}`
  const want = mac(purpose, body, secret)
  const a = Buffer.from(got ?? '')
  const b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' }
  if (now.getTime() > expiresMs) return { ok: false, reason: 'expired' }
  return { ok: true, storeId, cartId, customerId: customer === '-' ? null : customer }
}

export function signHandoffToken(
  p: CheckoutPayload,
  secret: string,
  ttlMs = CHECKOUT_HANDOFF_TTL_MS,
  now = new Date(),
): string {
  return sign('checkout-handoff', p, secret, ttlMs, now)
}

export function verifyHandoffToken(token: string, secret: string, now = new Date()): Verified {
  return verify('checkout-handoff', token, secret, now)
}

export function signCheckoutSession(
  p: CheckoutPayload,
  secret: string,
  ttlMs = CHECKOUT_SESSION_TTL_MS,
  now = new Date(),
): string {
  return sign('checkout-session', p, secret, ttlMs, now)
}

export function verifyCheckoutSession(token: string, secret: string, now = new Date()): Verified {
  return verify('checkout-session', token, secret, now)
}
