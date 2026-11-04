import { dayKey } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { importedTrafficDay, marketingSession } from '@commerce/db'
import { and, count, gte, lt, lte, sql, sum } from 'drizzle-orm'

/**
 * Storefront sessions, Shopify's definition: one visit, so one visitor can have many. The
 * beacon writes a `marketing_session` row when a visit starts (no `wc_ses` cookie, which lapses
 * after 30 minutes without a page view) or when a tagged landing starts a new one. Only
 * shoppers who accepted analytics are counted, as with every storefront number.
 *
 * Days from the store's old platform (`imported_traffic_day`) are added to the daily counts.
 * Shopify gives no hours, so a single-day view by hour shows only sessions counted here.
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
  if (hourly)
    return Array.from({ length: 24 }, (_, h) => byKey.get(String(h).padStart(2, '0')) ?? 0)
  const imported = await importedByDay(tx, w.days)
  return w.days.map((d) => (byKey.get(d) ?? 0) + (imported.get(d) ?? 0))
}

/** Imported sessions for these days (`YYYY-MM-DD`, in order). */
async function importedByDay(tx: StoreTx, days: string[]): Promise<Map<string, number>> {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return new Map()
  const rows = await tx
    .select({ day: importedTrafficDay.day, n: importedTrafficDay.sessions })
    .from(importedTrafficDay)
    .where(and(gte(importedTrafficDay.day, first), lte(importedTrafficDay.day, last)))
  return new Map(rows.map((r) => [r.day, r.n]))
}

/** The days in [from, to) with imported traffic: their imported orders can convert sessions. */
export async function importedTrafficDays(tx: StoreTx, from: Date, to: Date): Promise<Set<string>> {
  const rows = await tx
    .select({ day: importedTrafficDay.day })
    .from(importedTrafficDay)
    .where(and(gte(importedTrafficDay.day, dayKey(from)), lt(importedTrafficDay.day, dayKey(to))))
  return new Set(rows.map((r) => r.day))
}

/** Sessions started in [from, to). */
export async function totalSessions(tx: StoreTx, from: Date, to: Date): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, from), lt(marketingSession.startedAt, to)))
  const [imported] = await tx
    .select({ n: sum(importedTrafficDay.sessions) })
    .from(importedTrafficDay)
    .where(and(gte(importedTrafficDay.day, dayKey(from)), lt(importedTrafficDay.day, dayKey(to))))
  return (row?.n ?? 0) + Number(imported?.n ?? 0)
}
