/** SOURCE OF TRUTH: a store whose onboarding never finished — WHAT: `unfinishedStore` says whether the owner's store stopped part way through `createStore` (the store and organization exist, the last step did not commit), with the name and address to finish it under / WHY: a failure in that last step left a store the owner could open but not use (#1778); the admin now sends them back to onboarding, which picks up the same store. */
import { type Db, organizationMembership, store, theme, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { deterministicStoreId } from './service'
import { isOwnerRole } from './signup-gate'

export type UnfinishedStore = { name: string; slug: string }

/**
 * The organization's store when `userId` owns it and its setup did not finish, else null.
 *
 * `createStore`'s last step (roles, owner, theme, market, shipping, apps) is one transaction,
 * so a store with no theme never got there. Only stores `createStore` made count (their id is
 * derived from the owner and the address), so a store made any other way is never sent back.
 */
export async function unfinishedStore(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<UnfinishedStore | null> {
  const membership = await organizationMembership(db, organizationId, userId)
  if (!membership?.storeId || !isOwnerRole(membership.role)) return null
  const storeId = membership.storeId
  return withStore(db, storeId, async (tx) => {
    const [[row], [hasTheme]] = await Promise.all([
      tx.select({ name: store.name, slug: store.slug }).from(store).where(eq(store.id, storeId)),
      tx.select({ id: theme.id }).from(theme).where(eq(theme.storeId, storeId)).limit(1),
    ])
    if (!row || hasTheme) return null
    if (deterministicStoreId(userId, row.slug) !== storeId) return null
    return { name: row.name, slug: row.slug }
  })
}
