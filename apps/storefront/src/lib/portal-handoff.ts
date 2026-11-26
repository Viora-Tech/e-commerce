import { openToken, randomToken, signToken } from '@commerce/core'

/*
 * Carries a signed-in shopper from the store's domain (`www.waimers.in/affiliate/continue`, where
 * their host-only session cookie is) to the portal host (`affiliate.waimers.in/auth?t=`), which
 * starts its own session. Signed for this purpose only, for one store, good for two minutes; the
 * nonce makes it single use (`app/-f/[storeId]/auth/route.ts` spends it once).
 */

/** Two minutes: the token is followed by a redirect straight away. */
export const PORTAL_HANDOFF_TTL_MS = 2 * 60_000

type PortalHandoff = {
  /** Store id. */
  s: string
  /** Customer id. */
  c: string
  /** Nonce, spent once. */
  n: string
  /** Expiry, ms since epoch. */
  e: number
}

/** A hand-off token for this shopper of this store. */
export function signPortalHandoff(
  storeId: string,
  customerId: string,
  secret: string,
  now = Date.now(),
): string {
  const payload: PortalHandoff = {
    s: storeId,
    c: customerId,
    n: randomToken(12),
    e: now + PORTAL_HANDOFF_TTL_MS,
  }
  return signToken(payload, secret, 'affiliate-portal')
}

/** The shopper and nonce a token carries, or null when it is forged, expired or another store's. */
export function openPortalHandoff(
  token: unknown,
  storeId: string,
  secret: string,
  now = new Date(),
): { customerId: string; nonce: string } | null {
  const opened = openToken<PortalHandoff>(token, secret, 'affiliate-portal', now)
  if (!opened.ok) return null
  const p = opened.payload
  if (p.s !== storeId || typeof p.c !== 'string' || !p.c || typeof p.n !== 'string' || !p.n) {
    return null
  }
  return { customerId: p.c, nonce: p.n }
}
