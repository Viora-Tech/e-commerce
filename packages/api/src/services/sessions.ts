import type { StoreTx } from '@commerce/db'
import { marketingSession } from '@commerce/db'
import { and, count, gte, lt, sql } from 'drizzle-orm'

/**
 * Storefront sessions, Shopify's definition: one visit, so one visitor can have many. The
 * beacon writes a `marketing_session` row when a visit starts (no `wc_ses` cookie, which lapses
 * after 30 minutes without a page view) or when a tagged landing starts a new one. Only
 * shoppers who accepted analytics are counted, as with every storefront number.
 */
export async function countSessions(
  tx: StoreTx,
  w: { from: Date; to: Date; days: string[] },
  hourly: boolean,
): Promise<number[]> {
  /* A constant format, inlined so the select and the group-by are the same expression. */
  const key = sql<string>`to_char(${marketingSession.startedAt} at time zone 'Asia/Kolkata', ${sql.raw(hourly ? `'HH24'` : `'YYYY-MM-DD'`)})`
  const rows = await tx
    .select({ key, n: count() })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, w.from), lt(marketingSession.startedAt, w.to)))
    .groupBy(key)
  const byKey = new Map(rows.map((r) => [r.key, r.n]))
  return hourly
    ? Array.from({ length: 24 }, (_, h) => byKey.get(String(h).padStart(2, '0')) ?? 0)
    : w.days.map((d) => byKey.get(d) ?? 0)
}

/** Sessions started in [from, to). */
export async function totalSessions(tx: StoreTx, from: Date, to: Date): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, from), lt(marketingSession.startedAt, to)))
  return row?.n ?? 0
}
