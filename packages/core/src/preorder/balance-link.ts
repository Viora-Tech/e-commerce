import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * Signed order links: `<orderId>.<expiresMs>.<mac>`, HMAC-SHA256 over a
 * purpose-prefixed body so a cart recovery token (or a "view this order"
 * token) can never be replayed as a "pay your balance" token, and vice
 * versa. Same shape as `cart/abandoned.ts` recovery tokens. `signOrderToken`
 * / `verifyOrderToken` are the shared helper every purpose-specific token
 * (balance, order view, ...) is built on, so the HMAC and constant-time
 * comparison logic lives in exactly one place.
 */

/** Long enough to outlast the reminders and the store's pay-by window. */
export const BALANCE_LINK_TTL_MS = 60 * 86_400_000

/** Order confirmation / payment links are effectively permanent (~10 years). */
export const ORDER_LINK_TTL_MS = 10 * 365 * 86_400_000

const sign = (purpose: string, body: string, secret: string): string =>
  createHmac('sha256', secret).update(`${purpose}:${body}`).digest('base64url')

export function signOrderToken(
  purpose: string,
  orderId: string,
  secret: string,
  ttlMs: number,
  now = new Date(),
): string {
  const body = `${orderId}.${now.getTime() + ttlMs}`
  return `${body}.${sign(purpose, body, secret)}`
}

export function verifyOrderToken(
  purpose: string,
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
  const b = Buffer.from(sign(purpose, `${orderId}.${expires}`, secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' }
  if (expiresAt < now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, orderId }
}

export function balanceToken(orderId: string, secret: string, now = new Date()): string {
  return signOrderToken('balance', orderId, secret, BALANCE_LINK_TTL_MS, now)
}

export function verifyBalanceToken(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; orderId: string } | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  return verifyOrderToken('balance', token, secret, now)
}

/**
 * The "view this order" token on thank-you and pay links, so an order
 * number alone (sequential, enumerable) can never load someone else's
 * order. Same HMAC/verify helper as the balance link, a different purpose
 * prefix.
 */
export function orderViewToken(orderId: string, secret: string, now = new Date()): string {
  return signOrderToken('order-view', orderId, secret, ORDER_LINK_TTL_MS, now)
}

export function verifyOrderViewToken(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; orderId: string } | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  return verifyOrderToken('order-view', token, secret, now)
}

/**
 * Whether this request may see, or act on, an order: the signed-in customer who owns it,
 * or a valid view token minted for this exact order. The order number alone (sequential,
 * enumerable) is never enough. Every storefront action that mints a fresh view token for an
 * order ("Retry payment", "Pay balance", "New QR") goes through here first (security audit
 * 2026-10-06, A-00: they minted one for any order number a stranger sent).
 */
export function canViewOrder(
  o: { id: string; customerId: string | null },
  viewer: { customerId: string | null | undefined; token: string | null | undefined },
  secret: string,
  now = new Date(),
): boolean {
  if (viewer.customerId && o.customerId === viewer.customerId) return true
  if (!viewer.token) return false
  const verified = verifyOrderViewToken(viewer.token, secret, now)
  return verified.ok && verified.orderId === o.id
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

/** `/checkout/thank-you/<number>?t=<token>` — the unguessable, signed order link. */
export const thankYouPath = (orderNumber: number, token: string): string =>
  `/checkout/thank-you/${orderNumber}?t=${token}`

/** `/checkout/pay/<number>?t=<token>` — the unguessable, signed payment link. */
export const payPath = (orderNumber: number, token: string): string =>
  `/checkout/pay/${orderNumber}?t=${token}`

export function thankYouUrl(
  orderId: string,
  orderNumber: number,
  secret: string,
  storefrontUrl: string,
  now = new Date(),
): string {
  return `${storefrontUrl.replace(/\/$/, '')}${thankYouPath(orderNumber, orderViewToken(orderId, secret, now))}`
}

/** A draft invoice's pay link: long enough for a customer to come back to it. */
const INVOICE_LINK_TTL_MS = 30 * 86_400_000

/** The signed "pay this invoice" token in a draft invoice email (its own purpose prefix). */
function invoiceToken(orderId: string, secret: string, now = new Date()): string {
  return signOrderToken('draft-invoice', orderId, secret, INVOICE_LINK_TTL_MS, now)
}

export function verifyInvoiceToken(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; orderId: string } | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  return verifyOrderToken('draft-invoice', token, secret, now)
}

const invoicePath = (token: string): string => `/checkout/invoice/${token}`

/** The "Pay securely" button of a draft invoice email, on the store's own domain. */
export function invoiceUrl(
  orderId: string,
  secret: string,
  storefrontUrl: string,
  now = new Date(),
): string {
  return `${storefrontUrl.replace(/\/$/, '')}${invoicePath(invoiceToken(orderId, secret, now))}`
}
