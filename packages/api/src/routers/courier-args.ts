/**
 * What every courier call from the orders router needs, in the order the shipping service takes
 * it: the transaction, the store, its shipping registry and the settings secret.
 */
import { settingsSecret } from '@commerce/config'
import type { ShippingRegistry } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { storeRegistries } from '../services/apps.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

export async function courierArgs(
  context: Ctx,
): Promise<[tx: StoreTx, storeId: string, registry: ShippingRegistry, secret: string]> {
  const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
  return [context.tx, context.scope.storeId, shipping, settingsSecret()]
}
