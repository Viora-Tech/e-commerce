/** SOURCE OF TRUTH: retryCourierPushForOrder — WHAT: sends one order to a courier's panel again after it refused (order push) / WHY: the order page's "Send again" needs the store's courier, settings and name, which the router does not read itself */
import {
  parseShippingSettings,
  pushOrderTo,
  retryCourierOrder,
  shippingProviderById,
} from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import type { ShippingRegistry } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'

export async function retryCourierPushForOrder(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: { orderId: string; provider: string },
): Promise<{ sent: boolean }> {
  const [s] = await tx
    .select({ shipping: store.shipping, name: store.name })
    .from(store)
    .where(eq(store.id, storeId))
  const settings = parseShippingSettings(s?.shipping)
  const provider = shippingProviderById(registry, settings, secret, input.provider)
  if (!provider) throw new ORPCError('BAD_REQUEST', { message: 'That courier is not connected' })
  const ctx = { storeId, tx }
  await retryCourierOrder(ctx, input.orderId, input.provider)
  const sent = await pushOrderTo(ctx, provider, input.orderId, settings, s?.name ?? '')
  return { sent: sent === true }
}
