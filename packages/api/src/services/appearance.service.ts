import { normaliseAccent } from '@commerce/core/admin-accent'
import type { StoreTx } from '@commerce/db'
import { store, storeMember } from '@commerce/db'
import { and, eq } from 'drizzle-orm'

export type AccentChoice = {
  /** The member's own pick, null when they follow the store default. */
  mine: string | null
  /** The owner's pick for everyone who has not chosen, null for Ocean Green. */
  storeDefault: string | null
}

/** Both accent choices for a member. Stored values that are not a valid hex read as unset. */
export async function loadAccentChoice(
  tx: StoreTx,
  storeId: string,
  userId: string,
): Promise<AccentChoice> {
  const [s] = await tx
    .select({ accent: store.adminAccent })
    .from(store)
    .where(eq(store.id, storeId))
  const [m] = await tx
    .select({ accent: storeMember.adminAccent })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return { mine: normaliseAccent(m?.accent), storeDefault: normaliseAccent(s?.accent) }
}

export async function setMemberAccent(
  tx: StoreTx,
  storeId: string,
  userId: string,
  accent: string | null,
) {
  await tx
    .update(storeMember)
    .set({ adminAccent: accent, updatedAt: new Date() })
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
}

export async function setStoreAccent(tx: StoreTx, storeId: string, accent: string | null) {
  await tx.update(store).set({ adminAccent: accent }).where(eq(store.id, storeId))
}
