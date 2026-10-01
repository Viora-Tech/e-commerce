import { createHmac } from 'node:crypto'
import { safeEqual } from '@commerce/payments'

/**
 * Signed tokens for links inside marketing messages: the open pixel, tracked
 * clicks and unsubscribe. A bare message id would let anyone unsubscribe or
 * inflate stats for someone else, so every token carries an HMAC. Tokens are
 * scoped to one store; the storefront checks the store it was served on.
 */

const MAC_LENGTH = 22

function mac(body: string, secret: string): string {
  return createHmac('sha256', `marketing:${secret}`)
    .update(body)
    .digest('base64url')
    .slice(0, MAC_LENGTH)
}

export type MessageTokenPayload = { storeId: string; messageId: string }

/** `<storeId>.<messageId>.<mac>`: identifies one sent message (opens, unsubscribe). */
export function messageToken(p: MessageTokenPayload, secret: string): string {
  const body = `${p.storeId}.${p.messageId}`
  return `${body}.${mac(body, secret)}`
}

export function verifyMessageToken(token: string, secret: string): MessageTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [storeId, messageId, sig] = parts as [string, string, string]
  if (!storeId || !messageId || !safeEqual(sig, mac(`${storeId}.${messageId}`, secret))) return null
  return { storeId, messageId }
}

/** Click token: the message token plus a MAC over the destination, so it cannot be an open redirect. */
export function clickToken(p: MessageTokenPayload, url: string, secret: string): string {
  return `${messageToken(p, secret)}.${mac(`${p.storeId}.${p.messageId}|${url}`, secret)}`
}

export function verifyClickToken(
  token: string,
  url: string,
  secret: string,
): MessageTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const payload = verifyMessageToken(parts.slice(0, 3).join('.'), secret)
  if (!payload) return null
  const expected = mac(`${payload.storeId}.${payload.messageId}|${url}`, secret)
  return safeEqual(parts[3] as string, expected) ? payload : null
}

/**
 * Unsubscribe token for a customer (not a message), so the link in the
 * newsletter footer and the List-Unsubscribe header work for any send.
 */
export function unsubscribeToken(storeId: string, customerId: string, secret: string): string {
  const body = `u.${storeId}.${customerId}`
  return `${storeId}.${customerId}.${mac(body, secret)}`
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): { storeId: string; customerId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [storeId, customerId, sig] = parts as [string, string, string]
  if (!storeId || !customerId) return null
  return safeEqual(sig, mac(`u.${storeId}.${customerId}`, secret)) ? { storeId, customerId } : null
}

const base = (storefrontUrl: string) => storefrontUrl.replace(/\/$/, '')

export const openPixelUrl = (storefrontUrl: string, token: string) =>
  `${base(storefrontUrl)}/api/m/open/${token}`

export const clickUrl = (storefrontUrl: string, token: string, url: string) =>
  `${base(storefrontUrl)}/api/m/click/${token}?u=${encodeURIComponent(url)}`

export const unsubscribeUrl = (storefrontUrl: string, token: string) =>
  `${base(storefrontUrl)}/unsubscribe/${token}`

/** One-click unsubscribe endpoint for the List-Unsubscribe-Post header (RFC 8058). */
export const oneClickUnsubscribeUrl = (storefrontUrl: string, token: string) =>
  `${base(storefrontUrl)}/api/m/unsubscribe/${token}`
