import { refreshHomeCards } from '@commerce/core'
import { type Db, storesWithHomeCardsDue, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { HOME_CARDS_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

/** Checked hourly; each store is rebuilt once its cards are 20 hours old, so about daily. */
export const HOME_CARDS_EVERY_MS = 60 * 60_000

/**
 * Home's smart cards: one repeat job rebuilds the cards of every store whose last refresh is
 * 20 hours old, from its own numbers (`@commerce/core` home-cards). One store failing is
 * logged and skipped; Home rebuilds on open if a store is ever missed for a day.
 */
export function createHomeCardsRefresh(connection: IORedis, db: Db) {
  const queue = new Queue(HOME_CARDS_QUEUE, { connection })
  const worker = new Worker(
    HOME_CARDS_QUEUE,
    async () => {
      const storeIds = await storesWithHomeCardsDue(db)
      let cards = 0
      for (const storeId of storeIds) {
        try {
          cards += await withStore(db, storeId, (tx) => refreshHomeCards({ storeId, tx }))
        } catch (err) {
          logger.warn('home cards refresh failed', { storeId, error: err })
        }
      }
      return { stores: storeIds.length, cards }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
