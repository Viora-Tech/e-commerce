import { refreshHomeCards } from '@commerce/core'
import { type Db, storesWithHomeCardsDue, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** Checked hourly; each store is rebuilt once its cards are 20 hours old, so about daily. */
export const HOME_CARDS_EVERY_MS = 60 * 60_000

/**
 * Home's smart cards: one repeat job rebuilds the cards of every store whose last refresh is
 * 20 hours old, from its own numbers (`@commerce/core` home-cards). One store failing is
 * logged and skipped, and tried again on the next hourly run. Home only reads the cards.
 */
export function createHomeCardsRefresh(db: Db) {
  const run = async () => {
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
  }
  return { run }
}
