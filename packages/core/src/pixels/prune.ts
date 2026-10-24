/** SOURCE OF TRUTH: Pixels retention — WHAT: the daily `{pixels}-prune`: log and day rows older than 30 days are deleted and orders' tracking IP and user agent are cleared 30 days after the order / WHY: the event log is a debugger, not an archive, and an IP address is personal data we only need while Meta can still accept the event */
import { dayKey } from '@commerce/dates'
import {
  type Db,
  order,
  pixelEventDay,
  pixelEventLog,
  type StoreTx,
  storesWithOldPixelData,
  withStore,
} from '@commerce/db'
import { and, eq, lt, sql } from 'drizzle-orm'
import { PIXEL_LOG_RETENTION_DAYS } from './client'

const DAY_MS = 24 * 60 * 60 * 1000

export type PixelPruneOutcome = { stores: number; logs: number; days: number; orders: number }

/** One store's prune. */
export async function prunePixelData(
  tx: StoreTx,
  storeId: string,
  now: Date,
): Promise<Omit<PixelPruneOutcome, 'stores'>> {
  const cutoff = new Date(now.getTime() - PIXEL_LOG_RETENTION_DAYS * DAY_MS)
  const logs = await tx
    .delete(pixelEventLog)
    .where(and(eq(pixelEventLog.storeId, storeId), lt(pixelEventLog.createdAt, cutoff)))
    .returning({ id: pixelEventLog.id })
  const days = await tx
    .delete(pixelEventDay)
    .where(and(eq(pixelEventDay.storeId, storeId), lt(pixelEventDay.day, dayKey(cutoff))))
    .returning({ day: pixelEventDay.day })
  const orders = await tx
    .update(order)
    .set({ tracking: sql`${order.tracking} - 'ip' - 'ua'` })
    .where(
      and(
        eq(order.storeId, storeId),
        lt(order.placedAt, cutoff),
        sql`(${order.tracking} ? 'ip' or ${order.tracking} ? 'ua')`,
      ),
    )
    .returning({ id: order.id })
  return { logs: logs.length, days: days.length, orders: orders.length }
}

/** Every store with something past retention. One store failing does not stop the rest. */
export async function runPixelPruneJob(
  db: Db,
  now: Date = new Date(),
  log?: (message: string) => void,
): Promise<PixelPruneOutcome> {
  const out: PixelPruneOutcome = { stores: 0, logs: 0, days: 0, orders: 0 }
  for (const storeId of await storesWithOldPixelData(db, now)) {
    try {
      const r = await withStore(db, storeId, (tx) => prunePixelData(tx, storeId, now))
      out.stores += 1
      out.logs += r.logs
      out.days += r.days
      out.orders += r.orders
    } catch (err) {
      log?.(`[pixels] prune ${storeId} failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  return out
}
