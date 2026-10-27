/** SOURCE OF TRUTH: order numbers — WHAT: the next order (and draft) number of a store / WHY: one counter for checkout, drafts and imports, off the store row */
import type { StoreTx } from '@commerce/db'
import { newId, store, storeCounter } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'

const ORDER = 'order'

/** The pre-0177 counter on the store row, as SQL. */
const storeRowNext = (storeId: string) =>
  sql`(select ${store.nextOrderNumber} from ${store} where ${store.id} = ${storeId})`

const counterOf = (storeId: string) =>
  and(eq(storeCounter.storeId, storeId), eq(storeCounter.name, ORDER))

/**
 * Orders and drafts share one running number per store, kept in `store_counter` (0177) so the
 * checkout transaction that takes one no longer locks the `store` row (and with it every
 * settings save) until it commits.
 *
 * The counter first catches up with `store.next_order_number`, the counter before 0177: during
 * a rolling deploy an older build still takes numbers there, and a demo seed may still move it.
 * The unique `(store_id, number)` index refuses any number handed out twice.
 */
export async function takeOrderNumber(tx: StoreTx, storeId: string): Promise<number> {
  const taken = await bump(tx, storeId)
  if (taken !== null) return taken
  // A store made after 0177 has no counter row yet.
  await ensureCounter(tx, storeId)
  const retried = await bump(tx, storeId)
  if (retried === null) {
    throw new CommerceError('STORE_NOT_VISIBLE', `store ${storeId} not visible in context`)
  }
  return retried
}

/**
 * Keeps the next number above one an import brought over (`#1001` from Shopify), so a new order
 * never takes a number an imported one already has. Takes no number itself.
 */
export async function bumpOrderNumberPast(
  tx: StoreTx,
  storeId: string,
  number: number,
): Promise<void> {
  await ensureCounter(tx, storeId)
  await tx
    .update(storeCounter)
    .set({
      value: sql`greatest(${storeCounter.value}, ${storeRowNext(storeId)}, ${number + 1})`,
    })
    .where(counterOf(storeId))
}

/** Creates the store's counter from its store-row value when it has none; a no-op otherwise. */
async function ensureCounter(tx: StoreTx, storeId: string): Promise<void> {
  await tx
    .insert(storeCounter)
    .values({ id: newId(), storeId, name: ORDER, value: storeRowNext(storeId) })
    .onConflictDoNothing({ target: [storeCounter.storeId, storeCounter.name] })
}

/** Hands out `max(counter, store row)` and moves the counter one past it; null without a row. */
async function bump(tx: StoreTx, storeId: string): Promise<number | null> {
  const [row] = await tx
    .update(storeCounter)
    .set({ value: sql`greatest(${storeCounter.value}, ${storeRowNext(storeId)}) + 1` })
    .where(counterOf(storeId))
    .returning({ next: storeCounter.value })
  return row ? row.next - 1 : null
}
