/**
 * One-off: fetch the gateway's fee for captured Razorpay and Cashfree payments from the last
 * 90 days that do not have one, for every store (or one), instead of waiting for the regular
 * fee sync to get through them. Read-only on the gateways, one call at a time with a pause,
 * and idempotent: a payment with a fee is never asked again, and running it twice in six hours
 * asks nothing new.
 *
 *   bun run --cwd apps/worker fees:backfill               every store
 *   bun run --cwd apps/worker fees:backfill --store <id>  one store
 *   bun run --cwd apps/worker fees:backfill --days 30     a shorter window
 */
import { loadEnv } from '@commerce/config'
import { createDb, storesWithUnknownPaymentFees } from '@commerce/db'
import { syncStoreFees } from './payment-fees'

/** Payments asked about per round; rounds repeat until a store has none left. */
const BATCH = 200

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const env = loadEnv(process.env)
const db = createDb(env.DATABASE_URL)
const days = Math.min(90, Math.max(1, Number(arg('days') ?? 90) || 90))
const storeIds = arg('store') ? [arg('store') as string] : await storesWithUnknownPaymentFees(db)

for (const storeId of storeIds) {
  let checked = 0
  let recorded = 0
  let failed = 0
  try {
    for (;;) {
      const r = await syncStoreFees(db, storeId, env.SETTINGS_SECRET, { days, limit: BATCH })
      checked += r.checked
      recorded += r.recorded
      failed += r.failed
      if (r.checked < BATCH) break
    }
  } catch (err) {
    console.warn(
      `[fees:backfill] store ${storeId} stopped:`,
      err instanceof Error ? err.message : err,
    )
  }
  console.log(
    `[fees:backfill] ${storeId}: asked ${checked}, fee recorded ${recorded}, failed ${failed}`,
  )
}

await db.$client.end()
