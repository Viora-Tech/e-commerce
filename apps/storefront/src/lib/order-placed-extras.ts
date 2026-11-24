import 'server-only'
import { onOrderPlaced } from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { attachReferralAfterOrder } from './loyalty-shopper'
import { inStore } from './store-context'

/**
 * What checkout does once a new order is placed, none of which may fail it: marketing ends the
 * sequences the order converts and starts the order automations, and a Loyalty points friend
 * link kept in the browser is attached to the order's customer (the referral's friend step
 * then runs on delivery).
 */
export async function afterOrderPlaced(storeId: string, orderId: string): Promise<void> {
  await inStore(storeId, (tx) => onOrderPlaced(tx, storeId, orderId)).catch((err) =>
    logger.error('could not update marketing automations', { storeId, orderId, error: err }),
  )
  await attachReferralAfterOrder(storeId, orderId)
}
