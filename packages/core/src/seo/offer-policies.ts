/** SOURCE OF TRUTH: the shipping and returns facts a product page's structured data carries — WHAT: the store's return window (or no returns), the cheapest India shipping rate with its free-above threshold, and the delivery days / WHY: Google's merchant listings ask every Offer for `shippingDetails` and `hasMerchantReturnPolicy`; they must come from the store's real settings, the same ones the Shipping and Refund policy templates read */
import { type StoreTx, shippingRate, shippingZone, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { transitRange } from '../policies/client'
import { parseReturnPolicy } from '../returns/policy'
import { parseShippingSettings } from '../shipping/settings'

export type OfferPolicies = {
  returns: { enabled: boolean; windowDays: number }
  /** Null when the store has no shipping rates for India (shipping then costs nothing). */
  shipping: {
    /** The cheapest flat price of a rate with no order-value or weight condition. */
    fromPaise: number | null
    /** The lowest order value above which some India rate is free, when one is. */
    freeAbovePaise: number | null
    minDays: number
    maxDays: number
  } | null
}

/** A zone reaches India when it lists it (every zone made before markets lists IN). */
const reachesIndia = (codes: readonly string[]) => codes.includes('IN')

/** The store's returns and India shipping, read once per product page (store-cached by the caller). */
export async function productOfferPolicies(tx: StoreTx, storeId: string): Promise<OfferPolicies> {
  const [s] = await tx
    .select({ returns: store.returns, shipping: store.shipping })
    .from(store)
    .where(eq(store.id, storeId))
  const returns = parseReturnPolicy(s?.returns)
  const policy = parseShippingSettings(s?.shipping).policy
  const rows = await tx
    .select({
      countries: shippingZone.countryCodes,
      condition: shippingRate.condition,
      pricePaise: shippingRate.pricePaise,
      freeAbovePaise: shippingRate.freeAbovePaise,
      min: shippingRate.minTransitDays,
      max: shippingRate.maxTransitDays,
    })
    .from(shippingRate)
    .innerJoin(shippingZone, eq(shippingZone.id, shippingRate.zoneId))
  const india = rows.filter((r) => reachesIndia(r.countries))
  const flat = india.filter((r) => r.condition === 'none').map((r) => r.pricePaise)
  const free = india.map((r) => r.freeAbovePaise).filter((v): v is number => v != null && v > 0)
  return {
    returns: { enabled: returns.enabled, windowDays: returns.windowDays },
    shipping:
      india.length === 0
        ? null
        : {
            fromPaise: flat.length > 0 ? Math.min(...flat) : null,
            freeAbovePaise: free.length > 0 ? Math.min(...free) : null,
            ...transitRange(india, policy.defaultMinTransitDays, policy.defaultMaxTransitDays),
          },
  }
}
