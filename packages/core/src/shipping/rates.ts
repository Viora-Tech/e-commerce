import { z } from 'zod'

/**
 * Shipping rates: which zone an address falls in and what each of its rates
 * costs for a cart. Pure (no database, no clock), so the checkout preview, the
 * order transaction, the admin preview and the tests all run the same code.
 *
 * The model follows Saleor's shipping zones and methods (BSD-3): a zone is a
 * set of regions plus include/exclude postal rules, a method is price or
 * weight based between bounds. Offering several named options per zone that
 * the shopper picks from follows Medusa's shipping options (MIT). No code was
 * copied from either; the rules below are ours, India first (states and
 * six-digit PIN codes).
 */

export type PincodeRule = { pattern: string; mode: 'include' | 'exclude' }
export type ShippingRateCondition = 'none' | 'order_value' | 'weight'

export type ShippingZoneRateInput = {
  id: string
  name: string
  condition: ShippingRateCondition
  /** Paise for `order_value`, grams for `weight`. Inclusive. */
  minValue: number | null
  /** Exclusive, so neighbouring bands meet without a gap. Null means no upper bound. */
  maxValue: number | null
  pricePaise: number
  /** Free from this order value (after discounts) up. */
  freeAbovePaise: number | null
  /** Replaces the store's COD fee when set; null keeps the store's. */
  codSurchargePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
  position: number
}

export type ShippingZoneInput = {
  id: string
  name: string
  stateCodes: readonly string[]
  pincodeRules: readonly PincodeRule[]
  position: number
  rates: readonly ShippingZoneRateInput[]
}

export type ShippingDestination = { stateCode: string | null | undefined; pincode: string }

export type ShippingCartMeasure = {
  /** Goods after discounts, before the payment fee and shipping. */
  valuePaise: number
  /** Sum of variant weight × quantity; variants without a weight count as 0. */
  weightGrams: number
}

export type ShippingRateOption = {
  rateId: string
  name: string
  zoneId: string
  zoneName: string
  /** What the rate lists at, before a threshold makes it free. */
  listPricePaise: number
  pricePaise: number
  codSurchargePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
}

/** A rule pattern: six digits, or 1 to 5 digits followed by `*`. */
const PATTERN_RE = /^(?:[1-9]\d{5}|[1-9]\d{0,4}\*)$/

export const isPincodePattern = (p: string): boolean => PATTERN_RE.test(p)

export function pincodeMatches(pattern: string, pincode: string): boolean {
  if (pattern.endsWith('*')) return pincode.startsWith(pattern.slice(0, -1))
  return pincode === pattern
}

/**
 * How specific a match is: an exact PIN code beats a prefix, a longer prefix
 * beats a shorter one, any PIN code rule beats a state, a state beats a zone
 * that covers everywhere.
 */
function ruleScore(pattern: string): number {
  return pattern.endsWith('*') ? 10 + pattern.length - 1 : 20
}

/**
 * Specificity of `zone` for `to`, or null when the zone does not cover it.
 * An exclude rule always wins inside its zone: `560*` included and `560100`
 * excluded ships to every 560 code but that one. A zone with no states and
 * no include rules is the rest of India.
 */
export function zoneScore(
  zone: Pick<ShippingZoneInput, 'stateCodes' | 'pincodeRules'>,
  to: ShippingDestination,
) {
  const pin = to.pincode.trim()
  if (zone.pincodeRules.some((r) => r.mode === 'exclude' && pincodeMatches(r.pattern, pin))) {
    return null
  }
  const includes = zone.pincodeRules.filter((r) => r.mode === 'include')
  const best = includes
    .filter((r) => pincodeMatches(r.pattern, pin))
    .reduce<number | null>((acc, r) => Math.max(acc ?? 0, ruleScore(r.pattern)), null)
  if (best !== null) return best
  const state = to.stateCode?.trim().toUpperCase()
  if (state && zone.stateCodes.includes(state)) return 1
  if (zone.stateCodes.length === 0 && includes.length === 0) return 0
  return null
}

/** The one zone an address ships under: the most specific, then the first in the list. */
export function pickZone<Z extends ShippingZoneInput>(
  zones: readonly Z[],
  to: ShippingDestination,
): Z | null {
  let picked: { zone: Z; score: number } | null = null
  for (const zone of [...zones].sort((a, b) => a.position - b.position)) {
    const score = zoneScore(zone, to)
    if (score === null) continue
    if (!picked || score > picked.score) picked = { zone, score }
  }
  return picked?.zone ?? null
}

function inBand(rate: ShippingZoneRateInput, cart: ShippingCartMeasure): boolean {
  if (rate.condition === 'none') return true
  const v = rate.condition === 'weight' ? cart.weightGrams : cart.valuePaise
  if (rate.minValue !== null && v < rate.minValue) return false
  if (rate.maxValue !== null && v >= rate.maxValue) return false
  return true
}

/** The price of one rate for this cart; null when the cart is outside its band. */
export function priceRate(rate: ShippingZoneRateInput, cart: ShippingCartMeasure): number | null {
  if (!inBand(rate, cart)) return null
  if (rate.freeAbovePaise !== null && cart.valuePaise >= rate.freeAbovePaise) return 0
  return rate.pricePaise
}

/** Every rate of `zone` the cart qualifies for, cheapest first. */
export function ratesForZone(
  zone: ShippingZoneInput,
  cart: ShippingCartMeasure,
): ShippingRateOption[] {
  const options: (ShippingRateOption & { position: number })[] = []
  for (const rate of zone.rates) {
    const price = priceRate(rate, cart)
    if (price === null) continue
    options.push({
      rateId: rate.id,
      name: rate.name,
      zoneId: zone.id,
      zoneName: zone.name,
      listPricePaise: rate.pricePaise,
      pricePaise: price,
      codSurchargePaise: rate.codSurchargePaise,
      minTransitDays: rate.minTransitDays,
      maxTransitDays: rate.maxTransitDays,
      position: rate.position,
    })
  }
  return options
    .sort((a, b) => a.pricePaise - b.pricePaise || a.position - b.position)
    .map(({ position: _, ...o }) => o)
}

export type ShippingQuote =
  /** The store has no zones: shipping is free, as it was before rates existed. */
  | { kind: 'not_configured' }
  /** Zones exist but none covers this address, or no rate fits this cart. */
  | { kind: 'no_rates' }
  | { kind: 'rates'; options: ShippingRateOption[] }

export function quoteShipping(
  zones: readonly ShippingZoneInput[],
  to: ShippingDestination,
  cart: ShippingCartMeasure,
): ShippingQuote {
  if (zones.length === 0) return { kind: 'not_configured' }
  const zone = pickZone(zones, to)
  if (!zone) return { kind: 'no_rates' }
  const options = ratesForZone(zone, cart)
  return options.length ? { kind: 'rates', options } : { kind: 'no_rates' }
}

/**
 * The order value from which shipping is free wherever the parcel goes, for
 * the cart's "Add ₹X for free shipping" line. Only a promise that holds for
 * every address counts: each zone needs a rate with no weight condition that
 * turns free, and the answer is the highest of those zones' thresholds. Null
 * when any zone has none (the cart then says shipping is worked out at checkout).
 */
export function freeShippingThreshold(zones: readonly ShippingZoneInput[]): number | null {
  if (zones.length === 0) return null
  let threshold = 0
  for (const zone of zones) {
    const free = zone.rates
      .filter((r) => r.condition !== 'weight' && r.freeAbovePaise !== null)
      .map((r) => r.freeAbovePaise as number)
    if (free.length === 0) return null
    threshold = Math.max(threshold, Math.min(...free))
  }
  return threshold
}

const paise = z.number().int().min(0).max(100_000_000)

export const PincodeRuleSchema = z.object({
  pattern: z
    .string()
    .trim()
    .refine(isPincodePattern, 'PIN code rules are six digits (560001) or a prefix and * (560*)'),
  mode: z.enum(['include', 'exclude']),
})

export const ShippingRateWriteSchema = z
  .object({
    /** Present when editing an existing rate; omitted for a new one. */
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'Give the rate a name').max(80),
    condition: z.enum(['none', 'order_value', 'weight']).default('none'),
    minValue: z.number().int().min(0).max(100_000_000).nullable().default(null),
    maxValue: z.number().int().min(0).max(100_000_000).nullable().default(null),
    pricePaise: paise,
    freeAbovePaise: paise.nullable().default(null),
    codSurchargePaise: paise.nullable().default(null),
    minTransitDays: z.number().int().min(0).max(60).nullable().default(null),
    maxTransitDays: z.number().int().min(0).max(60).nullable().default(null),
  })
  .refine((r) => r.minValue === null || r.maxValue === null || r.minValue < r.maxValue, {
    message: 'The upper bound must be above the lower bound',
    path: ['maxValue'],
  })
  .refine(
    (r) =>
      r.minTransitDays === null ||
      r.maxTransitDays === null ||
      r.minTransitDays <= r.maxTransitDays,
    { message: 'Maximum days must be at least the minimum', path: ['maxTransitDays'] },
  )
export type ShippingRateWrite = z.infer<typeof ShippingRateWriteSchema>

export const ShippingZoneWriteSchema = z.object({
  name: z.string().trim().min(1, 'Give the zone a name').max(80),
  stateCodes: z
    .array(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/),
    )
    .max(40)
    .default([]),
  pincodeRules: z.array(PincodeRuleSchema).max(500).default([]),
  rates: z.array(ShippingRateWriteSchema).max(50).default([]),
})
export type ShippingZoneWrite = z.infer<typeof ShippingZoneWriteSchema>
