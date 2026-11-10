import { createHash } from 'node:crypto'
import { clientIp } from '@commerce/core'

/**
 * Cookieless visit counting for shoppers who have not said yes to analytics (Shopify counts
 * them too, so without this our session count runs low). Nothing is stored in the browser and
 * nothing names a person: the id is a hash of a server secret, the IST day, the store, the
 * network address and the browser string. The day is in the hash, so the same shopper gets a
 * new id every day and visits cannot be joined across days. Only totals come out of it: one
 * `marketing_session` row per visit, with where the visit came from.
 *
 * A visit lasts while page views keep coming within 30 minutes, like the `wc_ses` cookie.
 */

export const ANONYMOUS_SESSION_TTL_SECONDS = 30 * 60

/** Prefix that keeps cookieless ids apart from the cookie ids (UUIDs) in reports. */
const ID_PREFIX = 'anon:'

export type AnonymousVisitInput = {
  secret: string
  /** IST calendar day, `YYYY-MM-DD`. */
  day: string
  storeId: string
  ip: string
  userAgent: string
}

/** The day's cookieless visitor id: `anon:` + 32 hex characters. */
export function anonymousVisitorId(input: AnonymousVisitInput): string {
  const hash = createHash('sha256')
    .update(
      ['anonymous-visit', input.secret, input.day, input.storeId, input.ip, input.userAgent].join(
        '\u0000',
      ),
    )
    .digest('hex')
  return `${ID_PREFIX}${hash.slice(0, 32)}`
}

/** Redis key that marks an open cookieless visit. */
export const anonymousSessionKey = (storeId: string, visitorId: string) =>
  `{anon-ses}:${storeId}:${visitorId}`

/**
 * The shopper's network address for the hash, or null when we cannot tell shoppers apart
 * (every visit would collapse into one). Cloudflare's header first: the store is only reached
 * through Cloudflare, and a forged header can only add a visit, never take data.
 */
export function visitAddress(headers: { get(name: string): string | null }): string | null {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf && cf.length <= 64 && /^[0-9a-fA-F:.]+$/.test(cf)) return cf
  const ip = clientIp(headers)
  return ip === 'unknown' ? null : ip
}

type SessionStore = {
  set(key: string, value: string, ex: 'EX', seconds: number, nx: 'NX'): Promise<unknown>
  expire(key: string, seconds: number): Promise<unknown>
}

/**
 * Opens or extends the cookieless visit. True when this page view starts a new visit (count
 * it), false when it continues one. A tagged landing (`forceNew`) starts a new visit even
 * inside an open one, as the cookie path does.
 */
export async function startsAnonymousSession(
  redis: SessionStore,
  key: string,
  forceNew: boolean,
): Promise<boolean> {
  const opened = await redis.set(key, '1', 'EX', ANONYMOUS_SESSION_TTL_SECONDS, 'NX')
  if (opened === 'OK') return true
  await redis.expire(key, ANONYMOUS_SESSION_TTL_SECONDS)
  return forceNew
}
