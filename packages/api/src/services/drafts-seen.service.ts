import { order, type StoreTx, storeMember } from '@commerce/db'
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm'

/**
 * The Drafts badge in the sidebar: shoppers' unpaid checkout drafts (waiting for payment, not
 * expired) with activity since this member last opened Orders › Drafts. Never opened: every
 * open one counts. Opening the page (`markDraftsSeen`) clears it.
 */
export async function unseenCheckoutDrafts(
  tx: StoreTx,
  storeId: string,
  userId: string,
): Promise<number> {
  const [member] = await tx
    .select({ seenAt: storeMember.draftsSeenAt })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  const seenAt = member?.seenAt ?? null
  const [row] = await tx
    .select({ n: count() })
    .from(order)
    .where(
      and(
        eq(order.status, 'draft'),
        sql`${order.draftSource} = 'checkout'`,
        isNull(order.draftExpiredAt),
        seenAt ? gt(order.lastActivityAt, seenAt) : undefined,
      ),
    )
  return row?.n ?? 0
}

/** This member has looked at Drafts now: the badge goes back to zero. Returns how many it cleared. */
export async function markDraftsSeen(
  tx: StoreTx,
  storeId: string,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const cleared = await unseenCheckoutDrafts(tx, storeId, userId)
  if (cleared === 0) return 0
  await tx
    .update(storeMember)
    .set({ draftsSeenAt: now })
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return cleared
}
