/** SOURCE OF TRUTH: the touch a list row carries — WHAT: listTouch, the four attribution fields a Source column needs / WHY: the drafts and abandoned checkouts lists show where the shopper came from without sending the whole touch */
import { type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { MarketingChannel } from './attribution'

/**
 * Enough of a stored touch (`order.attribution`, `cart.attribution`) to name where a sale came
 * from in a list: the marketing channel, plus the UTM source / medium and referring host that
 * pick out an AI agent or social channel (`channelOfAttribution`). Absent keys were not recorded.
 */
export type ListTouch = {
  channel: MarketingChannel
  source?: string
  medium?: string
  referrer?: string
}

/** The column's touch cut down to `ListTouch`; null when nothing was recorded. */
export function listTouch(column: AnyPgColumn): SQL<ListTouch | null> {
  return sql<ListTouch | null>`case when ${column} ->> 'channel' is null then null
    else jsonb_strip_nulls(jsonb_build_object(
      'channel', ${column} ->> 'channel', 'source', ${column} ->> 'source',
      'medium', ${column} ->> 'medium', 'referrer', ${column} ->> 'referrer')) end`
}
