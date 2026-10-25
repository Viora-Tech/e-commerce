import 'server-only'

import { settingsSecret } from '@commerce/config'
import { viewableOrderId } from '@commerce/core'
import { currentCustomer } from './customer-session'
import { inStore } from './store-context'

/**
 * The order's id when this request may act on it: the signed-in owner, or a valid view
 * token for this exact order (`viewableOrderId` in core). Null for a stranger holding only
 * the sequential order number, so no action ever mints a fresh view token (which opens the
 * thank-you page: name, address, phone, items) for an order its caller could not already see.
 */
export async function accessibleOrderId(
  storeId: string,
  orderNumber: number,
  token: string | null | undefined,
): Promise<string | null> {
  const me = await currentCustomer(storeId)
  return inStore(storeId, (tx) =>
    viewableOrderId(tx, orderNumber, { customerId: me?.id ?? null, token }, settingsSecret()),
  )
}
