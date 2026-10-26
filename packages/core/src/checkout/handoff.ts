import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * The checkout hand-off token: how a shopper's cart (and, if signed in, their identity) crosses
 * from the store origin to the branded, theme-free checkout origin (security audit D-01, phase B).
 * The store-origin `/checkout/start` route mints one and redirects to `checkout.<primary>/c/<token>`,
 * which verifies it and opens a checkout session. Same purpose-prefixed HMAC shape as the order
 * links in `preorder/balance-link.ts`, so a hand-off token can never be replayed as another token
 * signed under the same secret. Short-lived (2 min): it only has to survive one redirect.
 */

export const CHECKOUT_HANDOFF_TTL_MS = 2 * 60_000

const PURPOSE = 'checkout-handoff'

export type Handoff = {
  storeId: string
  cartId: string
  /** The signed-in shopper carried across, or null for a guest. */
  customerId: string | null
}

const mac = (body: string, secret: string): string =>
  createHmac('sha256', secret).update(`${PURPOSE}:${body}`).digest('base64url')

/** `<storeId>.<cartId>.<customerId|->.<expiresMs>.<mac>`. storeId/cartId/customerId are ids with no dots. */
export function signHandoffToken(
  h: Handoff,
  secret: string,
  ttlMs = CHECKOUT_HANDOFF_TTL_MS,
  now = new Date(),
): string {
  const body = `${h.storeId}.${h.cartId}.${h.customerId ?? '-'}.${now.getTime() + ttlMs}`
  return `${body}.${mac(body, secret)}`
}

export function verifyHandoffToken(
  token: string,
  secret: string,
  now = new Date(),
): (Handoff & { ok: true }) | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  const parts = token.split('.')
  if (parts.length !== 5) return { ok: false, reason: 'malformed' }
  const [storeId, cartId, customer, expires, got] = parts
  const expiresMs = Number(expires)
  if (!storeId || !cartId || !customer || !Number.isFinite(expiresMs)) {
    return { ok: false, reason: 'malformed' }
  }
  const body = `${storeId}.${cartId}.${customer}.${expires}`
  const want = mac(body, secret)
  const a = Buffer.from(got ?? '')
  const b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' }
  if (now.getTime() > expiresMs) return { ok: false, reason: 'expired' }
  return { ok: true, storeId, cartId, customerId: customer === '-' ? null : customer }
}
