/** SOURCE OF TRUTH: order numbers — WHAT: the next order number and the next draft number (#D1, #D2) of a store / WHY: one counter for checkout, converted drafts and imports, off the store row; drafts count on their own so a deleted draft leaves no gap in order numbers */
import type { StoreTx } from '@commerce/db'
import { newId, order, store, storeCounter } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'

const ORDER = 'order'
const DRAFT = 'draft'

/** The pre-0177 counter on the store row, as SQL. */
const storeRowNext = (storeId: string) =>
  sql`(select ${store.nextOrderNumber} from ${store} where ${store.id} = ${storeId})`

const counterOf = (storeId: string) =>
  and(eq(storeCounter.storeId, storeId), eq(storeCounter.name, ORDER))

/**
 * Orders share one running number per store, kept in `store_counter` (0177) so the
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

/** The highest draft number the store has handed out, plus one, as SQL (1 when none). */
const draftRowsNext = (storeId: string) =>
  sql`(select coalesce(max(${order.draftNumber}), 0) + 1 from ${order} where ${order.storeId} = ${storeId})`

const draftCounterOf = (storeId: string) =>
  and(eq(storeCounter.storeId, storeId), eq(storeCounter.name, DRAFT))

/**
 * The next draft number (#D1, #D2, ...), from its own `store_counter` row, so a draft deleted
 * or never placed leaves no gap in the order numbers (audit #26). The row is created on first
 * use from the drafts 0200 numbered, so it never repeats one of them. A draft takes its order
 * number only when it converts (`convertDraft`).
 */
export async function takeDraftNumber(tx: StoreTx, storeId: string): Promise<number> {
  await tx
    .insert(storeCounter)
    .values({ id: newId(), storeId, name: DRAFT, value: draftRowsNext(storeId) })
    .onConflictDoNothing({ target: [storeCounter.storeId, storeCounter.name] })
  const [row] = await tx
    .update(storeCounter)
    .set({ value: sql`${storeCounter.value} + 1` })
    .where(draftCounterOf(storeId))
    .returning({ next: storeCounter.value })
  if (!row) throw new CommerceError('STORE_NOT_VISIBLE', `store ${storeId} not visible in context`)
  return row.next - 1
}
