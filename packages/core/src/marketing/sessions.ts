import { cart, marketingSession, type StoreTx } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { type Attribution, compactAttribution } from './attribution'

/**
 * Record the start of a storefront session with the channel it arrived on.
 * Called by the beacon only when a new session begins, so this is one row
 * per session, not per page view.
 */
export async function recordMarketingSession(
  tx: StoreTx,
  storeId: string,
  input: { visitorId: string; attribution: Attribution; at?: Date | undefined },
): Promise<void> {
  const a = input.attribution
  await tx.insert(marketingSession).values({
    storeId,
    visitorId: input.visitorId.slice(0, 64),
    channel: a.channel,
    source: a.source ?? null,
    medium: a.medium ?? null,
    campaign: a.campaign ?? null,
    content: a.content ?? null,
    term: a.term ?? null,
    referrer: a.referrer ?? null,
    landingPath: a.landing ?? null,
    campaignId: isUuid(a.campaignId) ? a.campaignId : null,
    automationId: isUuid(a.automationId) ? a.automationId : null,
    startedAt: input.at ?? new Date(a.at),
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: string | undefined): v is string {
  return Boolean(v && UUID.test(v))
}

/** Stamp an open cart with the touch that brought the shopper; the order copies it. */
export async function setCartAttribution(
  tx: StoreTx,
  cartId: string,
  attribution: Attribution | null,
): Promise<void> {
  if (!attribution) return
  await tx
    .update(cart)
    .set({ attribution: compactAttribution(attribution) })
    .where(and(eq(cart.id, cartId), eq(cart.status, 'open')))
}
