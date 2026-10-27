/** SOURCE OF TRUTH: Cart retention — WHAT: which carts the nightly prune deletes (open with no email or phone, or converted: 30 days untouched; not converted with an email or phone: 90 days) and how a cart is unhooked from the rows that point at it / WHY: nothing else deletes carts, every visitor leaves one behind, and the Abandoned checkouts list never looks back more than 90 days */
import { cart, cartLine, marketingAutomationRun, notification, type StoreTx } from '@commerce/db'
import { and, eq, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm'

/** An open cart nobody can recover (no email or phone), or one that became an order. */
const CART_RETENTION_DAYS = 30
/** A cart with an email or phone: shown under Abandoned checkouts (up to 90 days back). */
const RECOVERABLE_CART_RETENTION_DAYS = 90

const DAY_MS = 86_400_000

/**
 * Delete up to `limit` carts past retention, with their lines; returns how many went. The rules
 * match `stores_with_retention_due` (migration 0177), which picks the stores to visit. Age is
 * `updated_at`, which every line or contact change touches (converting does not). Recovery
 * messages (`notification`) and marketing runs keep their rows with `cart_id` cleared;
 * `order.cart_id` and `automation_run.cart_id` have no foreign key, so orders and runs keep
 * the id. Carts another transaction holds (a shopper adding a line) are skipped until the
 * next batch or night.
 */
export async function pruneCartBatch(tx: StoreTx, now: Date, limit: number): Promise<number> {
  const cutoff = new Date(now.getTime() - CART_RETENTION_DAYS * DAY_MS)
  const recoverableCutoff = new Date(now.getTime() - RECOVERABLE_CART_RETENTION_DAYS * DAY_MS)
  const due = await tx
    .select({ id: cart.id })
    .from(cart)
    .where(
      or(
        and(
          eq(cart.status, 'open'),
          isNull(cart.email),
          isNull(cart.phone),
          lt(cart.updatedAt, cutoff),
        ),
        and(
          ne(cart.status, 'converted'),
          or(isNotNull(cart.email), isNotNull(cart.phone)),
          lt(cart.updatedAt, recoverableCutoff),
        ),
        and(eq(cart.status, 'converted'), lt(cart.updatedAt, cutoff)),
      ),
    )
    .limit(limit)
    .for('update', { skipLocked: true })
  const ids = due.map((r) => r.id)
  if (ids.length === 0) return 0
  await tx.update(notification).set({ cartId: null }).where(inArray(notification.cartId, ids))
  await tx
    .update(marketingAutomationRun)
    .set({ cartId: null })
    .where(inArray(marketingAutomationRun.cartId, ids))
  await tx.delete(cartLine).where(inArray(cartLine.cartId, ids))
  await tx.delete(cart).where(inArray(cart.id, ids))
  return ids.length
}
