/** SOURCE OF TRUTH: plan prices outside India — WHAT each plan costs per region and currency /
 * WHY decided with the owner on 2026-10-28 and kept beside `PLANS`. Nothing reads this until
 * Koomerce has a non-Indian payment gateway (Stripe or PayPal): `REGIONAL_PRICING_LIVE` is the
 * one switch. Fee rates and included orders are the same in every region. Pure, client-safe.
 */
import { type BillingInterval, PLANS, type PlanId } from './plans'

/** Off until a non-Indian gateway can bill these prices; the admin and the site show India only. */
export const REGIONAL_PRICING_LIVE = false

export type PriceRegion = 'india' | 'tier1' | 'tier2'
export type PriceCurrency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY'

/** The EU-27 plus the US, UK, Japan, Australia, Canada, Singapore and the UAE. */
const TIER1 = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE US GB JP AU CA SG AE'.split(
    ' ',
  ),
)

/** The store's country decides its prices; no country yet means India. */
export function regionForCountry(countryCode: string | null): PriceRegion {
  const code = countryCode?.trim().toUpperCase()
  if (!code || code === 'IN') return 'india'
  return TIER1.has(code) ? 'tier1' : 'tier2'
}

/** Monthly prices in whole units of each currency; India comes from `PLANS`. */
const MONTHLY: Record<
  Exclude<PriceRegion, 'india'>,
  Partial<Record<PriceCurrency, Record<PlanId, number>>>
> = {
  tier1: {
    USD: { starter: 19, growth: 49, pro: 129, scale: 349 },
    GBP: { starter: 15, growth: 39, pro: 99, scale: 279 },
    EUR: { starter: 17, growth: 45, pro: 119, scale: 319 },
    JPY: { starter: 2_900, growth: 7_500, pro: 19_800, scale: 52_000 },
  },
  tier2: {
    USD: { starter: 12, growth: 29, pro: 79, scale: 199 },
  },
}

/** Minor units per whole unit: yen has none. */
const MINOR: Record<PriceCurrency, number> = { INR: 100, USD: 100, GBP: 100, EUR: 100, JPY: 1 }

/**
 * A plan's price in minor units (paise, cents, pence; yen for JPY), before tax. Yearly is 10×
 * monthly everywhere. Null for a region and currency pair that has no price.
 */
export function regionalPrice(
  plan: PlanId,
  region: PriceRegion,
  currency: PriceCurrency,
  interval: BillingInterval,
): number | null {
  if (region === 'india') return currency === 'INR' ? PLANS[plan].pricePaise[interval] : null
  const monthly = MONTHLY[region][currency]?.[plan]
  if (monthly === undefined) return null
  return monthly * MINOR[currency] * (interval === 'year' ? 10 : 1)
}

/** Own it (self-hosted licence), in minor units: the one-time licence and the monthly care. */
export const OWN_IT_PRICES: Record<
  PriceRegion,
  { licence: number; carePerMonth: number; currency: 'INR' | 'USD' }
> = {
  india: { licence: 49_99_900, carePerMonth: 3_00_000, currency: 'INR' },
  tier1: { licence: 1_99_900, carePerMonth: 9_900, currency: 'USD' },
  tier2: { licence: 1_29_900, carePerMonth: 6_900, currency: 'USD' },
}
