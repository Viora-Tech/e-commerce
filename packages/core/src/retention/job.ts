/** SOURCE OF TRUTH: Retention job — WHAT: the daily `{retention}-prune` at 03:30 India time: for every store with something due (`stores_with_retention_due`, migration 0177), carts past retention (`carts.ts`), then dispatched outbox rows and old webhook payloads (`logs.ts`), 500 rows per statement, each batch in its own short transaction / WHY: a long delete holds row locks a shopper's checkout or a webhook may be waiting on; small batches commit fast and one store or table failing never stops the rest */
import { type Db, type StoreTx, storesWithRetentionDue, withStore } from '@commerce/db'
import { pruneCartBatch } from './carts'
import {
  deleteDispatchedOutboxBatch,
  scrubPaymentEventBatch,
  scrubShipmentWebhookEventBatch,
} from './logs'

/** BullMQ queue of the daily prune (braces keep its keys on one slot). */
export const RETENTION_QUEUE = '{retention}-prune'
/** Every day at 03:30 India time, when stores are quiet (BullMQ repeat options). */
export const RETENTION_SCHEDULE = { pattern: '30 3 * * *', tz: 'Asia/Kolkata' } as const

/** Rows per statement. */
const BATCH = 500
/** Batches per store and table in one run; a bigger backlog clears over the next nights. */
const MAX_BATCHES = 100

export type RetentionOutcome = {
  stores: number
  carts: number
  outboxEvents: number
  paymentPayloads: number
  shipmentPayloads: number
}

type Part = Exclude<keyof RetentionOutcome, 'stores'>

const PARTS: [Part, (tx: StoreTx, now: Date, limit: number) => Promise<number>][] = [
  ['carts', pruneCartBatch],
  ['outboxEvents', deleteDispatchedOutboxBatch],
  ['paymentPayloads', scrubPaymentEventBatch],
  ['shipmentPayloads', scrubShipmentWebhookEventBatch],
]

/**
 * Every store with something past retention, every part; a part that throws is logged and the
 * run goes on.
 */
export async function runRetentionJob(
  db: Db,
  now = new Date(),
  opts: { log?: (message: string) => void; batch?: number } = {},
): Promise<RetentionOutcome> {
  const limit = opts.batch ?? BATCH
  const out: RetentionOutcome = {
    stores: 0,
    carts: 0,
    outboxEvents: 0,
    paymentPayloads: 0,
    shipmentPayloads: 0,
  }
  for (const storeId of await storesWithRetentionDue(db, now)) {
    out.stores += 1
    for (const [part, batch] of PARTS) {
      try {
        for (let i = 0; i < MAX_BATCHES; i += 1) {
          const n = await withStore(db, storeId, (tx) => batch(tx, now, limit))
          out[part] += n
          if (n < limit) break
        }
      } catch (err) {
        opts.log?.(
          `[retention] ${part} for ${storeId} failed: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
  }
  return out
}
