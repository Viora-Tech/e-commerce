import { draftSeen, order, type StoreTx, storeMember } from '@commerce/db'
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm'

/**
 * The Drafts badge in the sidebar: shoppers' unpaid checkout drafts (waiting for payment, not
 * expired) this member has not opened since they last changed. Opening one draft
 * (`markDraftSeen`) takes one off the count (owner, 10 Nov 2026). Drafts older than the member's
 * last visit under the old rule (`drafts_seen_at`, opening the list) stay seen.
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
        sql`not exists (
          select 1 from ${draftSeen} s
          where s.order_id = ${order.id} and s.user_id = ${userId}
            and s.seen_at >= ${order.lastActivityAt}
        )`,
      ),
    )
  return row?.n ?? 0
}

/** This member opened one draft: it leaves their badge. True when the count went down. */
export async function markDraftSeen(
  tx: StoreTx,
  storeId: string,
  userId: string,
  orderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const before = await unseenCheckoutDrafts(tx, storeId, userId)
  await tx
    .insert(draftSeen)
    .values({ storeId, userId, orderId, seenAt: now })
    .onConflictDoUpdate({
      target: [draftSeen.storeId, draftSeen.userId, draftSeen.orderId],
      set: { seenAt: now },
    })
  return (await unseenCheckoutDrafts(tx, storeId, userId)) < before
}
