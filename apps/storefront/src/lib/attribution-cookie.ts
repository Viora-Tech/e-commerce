import {
  type Attribution,
  decodeAttribution,
  decodeReferral,
  encodeAttribution,
  withReferral,
} from '@commerce/core/marketing'
import { cookies } from 'next/headers'

/** Last non-direct touch, kept for the attribution window; stamped on carts and orders. */
export const ATTRIBUTION_COOKIE = 'wc_attr'
/** Present while a session is live; refreshed by every beacon, so it lapses after 30 idle minutes. */
export const SESSION_COOKIE = 'wc_ses'
/** Set by a tracked email or WhatsApp link for the landing page's beacon to pick up. */
export const MARKETING_CLICK_COOKIE = 'wc_mk'
/** Set by a short link (`/l/<slug>`) for the landing page's beacon: the link's id only. */
export const LINK_CLICK_COOKIE = 'wc_lk'
/**
 * The affiliate link the shopper last came through (Affiliates app): `<code>.<click time>`. Set
 * only after a yes to marketing cookies (owner, 12 Nov 2026): by the proxy on the landing, or by
 * `/api/referral` when the yes comes later in the visit. Lives for the store's link window.
 */
export const REFERRAL_COOKIE = 'wc_ref'

export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30
export const SESSION_MAX_AGE = 30 * 60
export const MARKETING_CLICK_MAX_AGE = 10 * 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type MarketingClick = {
  messageId: string
  campaignId?: string | undefined
  automationId?: string | undefined
}

/** `<messageId>.<campaignId|->.<automationId|->`; ids only, nothing personal. */
export function encodeMarketingClick(c: MarketingClick): string {
  return [c.messageId, c.campaignId ?? '-', c.automationId ?? '-'].join('.')
}

export function decodeMarketingClick(raw: string | undefined): MarketingClick | null {
  if (!raw) return null
  const [m, c, a] = raw.split('.')
  if (!m || !UUID.test(m)) return null
  return {
    messageId: m,
    campaignId: c && UUID.test(c) ? c : undefined,
    automationId: a && UUID.test(a) ? a : undefined,
  }
}

/** The short link a visit came through, from `wc_lk`; anything but a UUID is ignored. */
export function decodeLinkClick(raw: string | undefined): string | null {
  return raw && UUID.test(raw) ? raw : null
}

/**
 * The shopper's current touch, for server actions that create carts and place orders: the
 * analytics touch (only there after a yes to analytics) with the affiliate referral counted in.
 */
export async function readAttribution(): Promise<Attribution | null> {
  const jar = await cookies()
  return withReferral(
    decodeAttribution(jar.get(ATTRIBUTION_COOKIE)?.value),
    decodeReferral(jar.get(REFERRAL_COOKIE)?.value),
  )
}

export { encodeAttribution }
