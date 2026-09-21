import { loadEnv } from '@commerce/config'
import {
  builtInShippingRegistry,
  type DeliveryEstimate,
  parseShippingSettings,
  primaryShippingProvider,
  type Serviceability,
  type ShippingSettings,
  toShippingPolicy,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import {
  cacheGet,
  cacheSet,
  SERVICEABILITY_TTL_SECONDS,
  serviceabilityKey,
  sharedRedis,
} from '@commerce/queue'
import { describeCourierFailure, estimateDelivery, parsePincode } from '@commerce/shipping'
import { delhiveryFactory } from '@commerce/shipping-delhivery'
import { eq } from 'drizzle-orm'

/** Couriers this deployment ships. Adding one is one line here. */
export const shippingRegistry = builtInShippingRegistry().register(delhiveryFactory)

const env = () => loadEnv(process.env)

export async function loadShippingSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingSettings> {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return parseShippingSettings(s?.shipping)
}

/**
 * Delivery estimate for a pincode, with the courier's serviceability answer
 * cached per store for a day. The date maths always runs fresh - it depends
 * on the clock; the cache only remembers what the courier said.
 */
export async function estimateForPincode(
  tx: StoreTx,
  storeId: string,
  pincode: string,
): Promise<DeliveryEstimate> {
  const settings = await loadShippingSettings(tx, storeId)
  const secret = env().SETTINGS_SECRET
  const provider = primaryShippingProvider(shippingRegistry, settings, secret)
  const parsed = parsePincode(pincode)
  const policy = toShippingPolicy(settings)
  if (!provider || !parsed.ok) {
    return estimateDelivery({ pincode, policy, provider, now: new Date() })
  }

  const redis = sharedRedis(env().REDIS_URL)
  const key = serviceabilityKey(storeId, provider.id, parsed.pincode)
  let answer = await cacheGet<Serviceability>(redis, key)
  let reachable = true
  if (!answer) {
    try {
      answer = await provider.checkServiceability({
        originPincode: policy.originPincode,
        destinationPincode: parsed.pincode,
      })
      await cacheSet(redis, key, answer, SERVICEABILITY_TTL_SECONDS)
    } catch (err) {
      // Passing no provider below marks the estimate as a fallback without a second call.
      reachable = false
      console.warn(`[shipping] ${provider.id} lookup failed: ${describeCourierFailure(err)}`)
    }
  }
  return estimateDelivery({
    pincode: parsed.pincode,
    policy,
    provider: reachable ? provider : null,
    now: new Date(),
    cached: answer,
  })
}
