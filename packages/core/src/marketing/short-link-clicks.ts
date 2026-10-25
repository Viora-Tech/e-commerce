/** SOURCE OF TRUTH: short link click counting — WHAT: `/l/<slug>` lookup that counts today's click unless a bot / non-GET / WHY: one place decides what counts as a click */
import { dayKey } from '@commerce/dates'
import { type StoreTx, shortLink, shortLinkClickDay } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { isBotUserAgent, SHORT_LINK_SLUG } from './short-links'

/**
 * The storefront's `/l/<slug>`: the link, with the click counted on today's row (store time)
 * unless the request is a bot, a link preview or not a GET. Null for an unknown slug.
 */
export async function followShortLink(
  tx: StoreTx,
  storeId: string,
  slug: string,
  request: { userAgent: string | null; method: string; now?: Date | undefined },
) {
  const key = slug.toLowerCase()
  if (!SHORT_LINK_SLUG.test(key)) return null
  const [link] = await tx.select().from(shortLink).where(eq(shortLink.slug, key)).limit(1)
  if (!link) return null
  if (request.method === 'GET' && !isBotUserAgent(request.userAgent)) {
    await tx
      .insert(shortLinkClickDay)
      .values({ storeId, linkId: link.id, day: dayKey(request.now ?? new Date()), clicks: 1 })
      .onConflictDoUpdate({
        target: [shortLinkClickDay.linkId, shortLinkClickDay.day],
        set: { clicks: sql`${shortLinkClickDay.clicks} + 1` },
      })
  }
  return link
}
