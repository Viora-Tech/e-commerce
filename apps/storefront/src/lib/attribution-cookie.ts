import { type Attribution, decodeAttribution, encodeAttribution } from '@commerce/core/marketing'
import { cookies } from 'next/headers'

/** Last non-direct touch, kept for the attribution window; stamped on carts and orders. */
export const ATTRIBUTION_COOKIE = 'wc_attr'
/** Present while a session is live; refreshed by every beacon, so it lapses after 30 idle minutes. */
export const SESSION_COOKIE = 'wc_ses'
/** Set by a tracked email or WhatsApp link for the landing page's beacon to pick up. */
export const MARKETING_CLICK_COOKIE = 'wc_mk'

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

/** The shopper's current touch, for server actions that create carts. */
export async function readAttribution(): Promise<Attribution | null> {
  return decodeAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value)
}

export { encodeAttribution }
