import { lowestEmiPaise } from '@commerce/core/emi'

/*
 * The per-price offer, without the settings schema: the storefront's buy box runs
 * this in the browser for whichever variant is selected, so it stays free of zod
 * (`./offer` re-exports it for everything else).
 */

/** What the storefront needs to draw offers for any price on the page. Serialisable. */
export type EmiOffersConfig = {
  minPricePaise: number
  razorpayKeyId: string | null
}

/** The offer for one price, shaped for `EmiOffersBlock`; null below the minimum price. */
export function emiOfferFor(config: EmiOffersConfig | null, pricePaise: number) {
  if (!config || pricePaise <= 0 || pricePaise < config.minPricePaise) return null
  return {
    amountPaise: pricePaise,
    monthlyPaise: lowestEmiPaise(pricePaise),
    razorpayKeyId: config.razorpayKeyId,
  }
}
