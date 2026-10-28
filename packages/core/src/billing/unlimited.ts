/** SOURCE OF TRUTH: unlimited stores — WHAT switches a store onto Koomerce's own unlimited plan / WHY the owner's own stores (Waimers, 2026-10-29) have no limits, fees or bills; only `bun run platform:unlimited` sets it, never a merchant */
import { aiSettings, type Db, store, storePlan, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { PLANS } from './plans'
import { ensureStorePlan } from './service'

/**
 * On: Scale's features, no limits on orders, staff or storage, no per-order fee, no bills, no
 * fair-use notices, and the `internal` AI tier (a 50,000-credit safety cap). Off: back to a
 * normal Scale store whose AI follows the plan; billing then follows the plan row as it is.
 */
export async function setStoreUnlimited(
  db: Db,
  slug: string,
  on: boolean,
  now = new Date(),
): Promise<{ storeId: string; name: string } | null> {
  const [found] = await db
    .select({ id: store.id, name: store.name })
    .from(store)
    .where(eq(store.slug, slug))
  if (!found) return null
  await withStore(db, found.id, async (tx) => {
    await ensureStorePlan(tx, found.id, now)
    await tx
      .update(storePlan)
      .set(
        on
          ? { unlimited: true, plan: 'scale', status: 'active', nextPlan: null, updatedAt: now }
          : { unlimited: false, updatedAt: now },
      )
      .where(eq(storePlan.storeId, found.id))
    const ai = on ? 'internal' : PLANS.scale.ai
    await tx
      .insert(aiSettings)
      .values({ storeId: found.id, plan: ai })
      .onConflictDoUpdate({ target: aiSettings.storeId, set: { plan: ai, updatedAt: now } })
  })
  return { storeId: found.id, name: found.name }
}
