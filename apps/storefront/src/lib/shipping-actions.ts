'use server'

import type { DeliveryEstimate } from '@commerce/core'
import { estimateForPincode } from './shipping'
import { inStore } from './store-context'

/** Product page "check delivery" widget. The store id comes from the route, never the client. */
export async function estimateDeliveryAction(
  storeId: string,
  pincode: string,
): Promise<DeliveryEstimate> {
  return inStore(storeId, (tx) => estimateForPincode(tx, storeId, pincode))
}
