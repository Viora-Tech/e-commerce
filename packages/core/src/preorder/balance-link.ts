import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * The signed "pay your balance" link sent with a balance request or reminder.
 * `<orderId>.<expiresMs>.<mac>`, HMAC-SHA256 over a purpose-prefixed body so
 * a cart recovery token can never be replayed here. Same shape as
 * `cart/abandoned.ts` recovery tokens.
 */

/** Long enough to outlast the reminders and the store's pay-by window. */
export const BALANCE_LINK_TTL_MS = 60 * 86_400_000

const sign = (body: string, secret: string): string =>
  createHmac('sha256', secret).update(`balance:${body}`).digest('base64url')

export function balanceToken(orderId: string, secret: string, now = new Date()): string {
  const body = `${orderId}.${now.getTime() + BALANCE_LINK_TTL_MS}`
  return `${body}.${sign(body, secret)}`
}

export function verifyBalanceToken(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; orderId: string } | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [orderId, expires, mac] = parts as [string, string, string]
  const expiresAt = Number(expires)
  if (!orderId || !Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' }
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(`${orderId}.${expires}`, secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' }
  if (expiresAt < now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, orderId }
}

export const balancePath = (token: string): string => `/checkout/balance/${token}`

export function balanceUrl(
  orderId: string,
  secret: string,
  storefrontUrl: string,
  now = new Date(),
): string {
  return `${storefrontUrl.replace(/\/$/, '')}${balancePath(balanceToken(orderId, secret, now))}`
}
