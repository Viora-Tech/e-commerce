import {
  type FeeSyncOptions,
  type FeeSyncResult,
  parsePaymentSettings,
  refreshPaymentCredentials,
  resolvePaymentProviders,
  syncPaymentFees,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithUnknownPaymentFees, withStore } from '@commerce/db'
import { type IORedis, PAYMENT_FEES_QUEUE, Queue, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** How often the fee sync runs. Razorpay usually reports the fee on capture; Cashfree after settling. */
export const PAYMENT_FEES_EVERY_MS = 30 * 60_000

/** Payments asked about per store per run, so one busy store cannot hold the tick for long. */
const PER_STORE_LIMIT = 100

/** The store's switched-on gateways, with OAuth tokens renewed first (asking needs a live one). */
async function providersFor(db: Db, storeId: string, settingsSecret: string) {
  return withStore(db, storeId, async (tx) => {
    const { payments } = await registriesForStore(tx, storeId)
    await refreshPaymentCredentials({ storeId, tx }, payments, settingsSecret)
    const [s] = await tx
      .select({ payments: store.payments })
      .from(store)
      .where(eq(store.id, storeId))
    return resolvePaymentProviders(payments, parsePaymentSettings(s?.payments), settingsSecret)
      .providers
  })
}

/** One store's fee sync: its gateways are resolved, then asked one payment at a time. */
export async function syncStoreFees(
  db: Db,
  storeId: string,
  settingsSecret: string,
  opts: FeeSyncOptions = {},
): Promise<FeeSyncResult> {
  const providers = await providersFor(db, storeId, settingsSecret)
  return syncPaymentFees(db, storeId, providers, opts)
}

/**
 * Every store with a recent Razorpay or Cashfree capture whose fee is not known yet. One store
 * failing is logged and skipped; the next run tries again.
 */
export async function syncAllStoreFees(db: Db, settingsSecret: string, opts: FeeSyncOptions = {}) {
  const totals: FeeSyncResult = { checked: 0, recorded: 0, pending: 0, failed: 0 }
  const storeIds = await storesWithUnknownPaymentFees(db)
  for (const storeId of storeIds) {
    try {
      const r = await syncStoreFees(db, storeId, settingsSecret, opts)
      totals.checked += r.checked
      totals.recorded += r.recorded
      totals.pending += r.pending
      totals.failed += r.failed
    } catch (err) {
      console.warn(`[fees] store ${storeId} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return { stores: storeIds.length, ...totals }
}

/**
 * Repeat job: asks Razorpay and Cashfree for the fee on payments whose capture did not carry
 * it (core payments/charges.ts). Covers the last 90 days, so it also backfills older orders a
 * little at a time; `bun run fees:backfill` does the same at once.
 */
export function createPaymentFeeSync(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue(PAYMENT_FEES_QUEUE, { connection })
  const worker = new Worker(
    PAYMENT_FEES_QUEUE,
    async () => {
      const r = await syncAllStoreFees(db, opts.settingsSecret, { limit: PER_STORE_LIMIT })
      if (r.checked) {
        console.log(
          `[fees] stores=${r.stores} checked=${r.checked} recorded=${r.recorded} pending=${r.pending} failed=${r.failed}`,
        )
      }
      return r
    },
    { connection },
  )
  return { queue, worker }
}
