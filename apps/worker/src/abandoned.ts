import {
  cartsAwaitingRecovery,
  deliverCartRecovery,
  markRecoverySent,
  parseNotificationSettings,
  recoveryUrl,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithAbandonedCarts, withStore } from '@commerce/db'
import { ABANDONED_SWEEP_QUEUE, type IORedis, Queue, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** How often baskets are swept. */
export const SWEEP_EVERY_MS = 60 * 60_000
/** How long a basket must sit before the automatic nudge goes out. */
export const RECOVER_AFTER_MS = 4 * 60 * 60_000
/** Cap per store per tick, so one busy store cannot flood a channel. */
const PER_STORE_LIMIT = 25

/**
 * One repeat job nudges shoppers who left a basket behind, for the stores that
 * asked for it. Opt-in per store (`notifications.recoverAbandoned`) because an
 * unasked-for email is worse than a lost sale, and once per cart: the recovery
 * timestamp is written as soon as a channel accepts the message.
 */
export function createAbandonedSweeper(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string; storefrontUrl: string },
) {
  const queue = new Queue(ABANDONED_SWEEP_QUEUE, { connection })
  const worker = new Worker(
    ABANDONED_SWEEP_QUEUE,
    async () => {
      const cutoff = new Date(Date.now() - RECOVER_AFTER_MS)
      const storeIds = await storesWithAbandonedCarts(db, cutoff)
      let sent = 0
      for (const storeId of storeIds) {
        const { optedIn, carts, registries } = await withStore(db, storeId, async (tx) => {
          const [s] = await tx
            .select({ notifications: store.notifications })
            .from(store)
            .where(eq(store.id, storeId))
          const settings = parseNotificationSettings(s?.notifications)
          return {
            optedIn: settings.recoverAbandoned && settings.enabled.length > 0,
            carts: await cartsAwaitingRecovery(
              { storeId, tx },
              { afterMs: RECOVER_AFTER_MS, limit: PER_STORE_LIMIT },
            ),
            registries: await registriesForStore(tx, storeId),
          }
        })
        if (!optedIn) continue
        for (const c of carts) {
          try {
            const results = await withStore(db, storeId, async (tx) => {
              const ctx = { storeId, tx }
              const r = await deliverCartRecovery(
                ctx,
                {
                  cartId: c.id,
                  actionUrl: recoveryUrl(c.id, opts.settingsSecret, opts.storefrontUrl),
                },
                { registry: registries.notifications, settingsSecret: opts.settingsSecret },
              )
              if (r.some((x) => x.ok)) await markRecoverySent(ctx, c.id)
              return r
            })
            if (results.some((r) => r.ok)) sent += 1
          } catch (err) {
            console.warn(`[abandoned] recovery for cart ${c.id} failed:`, err)
          }
        }
      }
      return { stores: storeIds.length, sent }
    },
    { connection },
  )
  return { queue, worker }
}
