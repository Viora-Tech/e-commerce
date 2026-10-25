/** SOURCE OF TRUTH: Pixels server Purchase planner — WHAT: for an order placed / paid / delivered outbox row, picks each pixel whose Purchase trigger matches, logs the skips (test, imported, no tracking, no consent, older than 7 days, paused, errored) and queues one send job per pixel / WHY: the server Purchase is what survives ad blockers and closed tabs, and it must fire once per pixel at the moment the merchant chose */
import { type Db, order, outboxEvent, pixelConnection, withStore } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import {
  type OrderPurchaseEvent,
  purchaseEventId,
  purchaseSkipReason,
  purchaseTriggerMatches,
} from './client'
import {
  type PixelOrderJob,
  type PixelOrderSendJob,
  type PixelSendQueue,
  sendJobOptions,
} from './jobs'
import { findLogRow, logSkip, upsertLogRow } from './log'

const ORDER_EVENTS: ReadonlySet<string> = new Set(['order.placed', 'order.paid', 'order.delivered'])

export type OrderJobOutcome = { queued: number; skipped: number }

/**
 * The `{pixels}-order` job for one outbox row. Idempotent: a re-run finds the log rows it wrote
 * (a sent Purchase is never queued again) and the send job ids collapse in BullMQ.
 */
export async function runPixelOrderJob(
  db: Db,
  job: PixelOrderJob,
  sendQueue: PixelSendQueue,
  now: Date = new Date(),
): Promise<OrderJobOutcome> {
  const planned = await withStore(db, job.storeId, async (tx) => {
    const [row] = await tx.select().from(outboxEvent).where(eq(outboxEvent.id, job.outboxId))
    if (!row || !ORDER_EVENTS.has(row.type)) return null
    const orderId = (row.payload as { orderId?: string }).orderId
    if (!orderId) return null
    const [o] = await tx
      .select({
        id: order.id,
        totalPaise: order.totalPaise,
        isTest: order.isTest,
        importedFrom: order.importedFrom,
        tracking: order.tracking,
        placedAt: order.placedAt,
        paymentMethod: order.paymentMethod,
      })
      .from(order)
      .where(eq(order.id, orderId))
    if (!o) return null
    const pixels = await tx
      .select()
      .from(pixelConnection)
      .where(and(eq(pixelConnection.storeId, job.storeId), eq(pixelConnection.platform, 'meta')))
    const eventId = purchaseEventId(o.id)
    const jobs: PixelOrderSendJob[] = []
    let skipped = 0
    for (const p of pixels) {
      // Browser only, Purchase switched off, or not this pixel's moment: nothing to send or log.
      if (!p.tokenEnc || !p.events.includes('Purchase')) continue
      if (
        !purchaseTriggerMatches(p.purchaseTrigger, row.type as OrderPurchaseEvent, o.paymentMethod)
      )
        continue
      const key = {
        storeId: job.storeId,
        connectionId: p.id,
        eventName: 'Purchase' as const,
        eventId,
        origin: 'order' as const,
      }
      const existing = await findLogRow(tx, key)
      if (existing?.status === 'sent') continue
      const extra = { orderId: o.id, valuePaise: o.totalPaise }
      const reason =
        purchaseSkipReason(o, now) ??
        (p.status === 'paused' ? 'paused' : p.status === 'errored' ? 'errored' : null)
      if (reason) {
        await logSkip(tx, key, reason, extra, now)
        skipped += 1
        continue
      }
      await upsertLogRow(tx, key, { status: 'queued', ...extra })
      jobs.push({
        storeId: job.storeId,
        connectionId: p.id,
        origin: 'order',
        eventName: 'Purchase',
        eventId,
        orderId: o.id,
      })
    }
    return { jobs, skipped }
  })
  if (!planned) return { queued: 0, skipped: 0 }
  for (const j of planned.jobs) await sendQueue.add('send', j, sendJobOptions(j))
  return { queued: planned.jobs.length, skipped: planned.skipped }
}
