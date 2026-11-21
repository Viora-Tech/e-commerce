import { type StoreActivitySource, type StoreTx, storeActivity } from '@commerce/db'
import { and, asc, eq, or, sql } from 'drizzle-orm'

/** Who made a staff draft, for its "Where it came from" card. */
export type DraftCreator = {
  /** The member's name, else their email; null when the log row kept neither. */
  name: string | null
  /** Admin, the AI assistant, an MCP client or an access token. */
  source: StoreActivitySource
  at: Date
}

/**
 * The member who made a staff draft, read from Settings → Activity log: the `orders.saveDraft`
 * call that created it (its input carries no draft id; later saves do) or the
 * `orders.duplicateOrder` call that copied it from an order (the log names the new draft since
 * 18 Nov 2026). Null when the log has no such row: a draft older than the log or its year of
 * history, or one made outside a member's session (seed data).
 */
export async function draftCreator(
  tx: StoreTx,
  storeId: string,
  draftId: string,
): Promise<DraftCreator | null> {
  const [row] = await tx
    .select({
      name: storeActivity.actorName,
      email: storeActivity.actorEmail,
      source: storeActivity.source,
      at: storeActivity.createdAt,
    })
    .from(storeActivity)
    .where(
      and(
        eq(storeActivity.storeId, storeId),
        eq(storeActivity.resourceId, draftId),
        or(
          and(
            eq(storeActivity.action, 'orders.saveDraft'),
            sql`(${storeActivity.changes} -> 'input' ->> 'id') is null`,
          ),
          eq(storeActivity.action, 'orders.duplicateOrder'),
        ),
      ),
    )
    .orderBy(asc(storeActivity.createdAt))
    .limit(1)
  if (!row) return null
  return { name: row.name || row.email || null, source: row.source, at: row.at }
}
