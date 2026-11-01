/** SOURCE OF TRUTH: order archiving — WHAT `order.archived_at`, set and cleared from the Orders list (#1007) / WHY an archived order is a kept record off the working tabs (All, Unfulfilled, Ready to ship); it shows only under Archived and nothing else about it changes */
import { order } from '@commerce/db'
import { and, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'

/**
 * Archive (or unarchive) placed orders. Orders already in that state, drafts and ids from
 * another store are left alone; returns how many changed and how many were skipped.
 */
export async function setOrdersArchived(
  ctx: StoreContext,
  ids: readonly string[],
  archived: boolean,
): Promise<{ updated: number; skipped: number }> {
  if (ids.length === 0) return { updated: 0, skipped: 0 }
  const rows = await ctx.tx
    .update(order)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        inArray(order.id, [...ids]),
        ne(order.status, 'draft'),
        archived ? isNull(order.archivedAt) : isNotNull(order.archivedAt),
      ),
    )
    .returning({ id: order.id })
  return { updated: rows.length, skipped: ids.length - rows.length }
}
