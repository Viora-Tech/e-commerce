/** SOURCE OF TRUTH: local delivery and pickup in store (audit #163) — WHAT: delivery options a location offers on its own, beside the zone rates / WHY: pure, so checkout, place order and the tests run the same rule */
import { z } from 'zod'
import {
  destinationCountry,
  HOME_COUNTRY,
  isPincodePattern,
  pincodeMatches,
  type ShippingDestination,
  type ShippingQuote,
  type ShippingRateOption,
} from './rates'

/**
 * Local delivery and pickup in store (audit #163): delivery options a location offers on its
 * own, beside the zone rates. Pure, so checkout, place order and the tests run the same rule.
 *
 * THE RULE:
 * - Local delivery from a location applies to an address in India whose PIN code matches one of
 *   the location's PIN codes (six digits, or a prefix and `*`), when the order (after discounts)
 *   reaches its minimum. It costs its price, free from its "free above" value.
 * - Pickup in store at a location is offered for every address in India; it is free.
 * - Only active locations with the option switched on count. Each becomes one more option the
 *   shopper picks from, after the zone rates (`withLocalOptions`). A store with no zones keeps
 *   shipping free and shows no local options; an address no zone covers can still pick these.
 * - Their rate ids are `local:<location id>` and `pickup:<location id>`: no rate row, so the
 *   order's `shipping_rate_id` stays null (`rateRowId`) and its snapshot keeps `local`.
 */

export const LOCAL_RATE_PREFIX = 'local:'
export const PICKUP_RATE_PREFIX = 'pickup:'

/** A local delivery or pickup option's id: not a rate row. */
export const isLocalRateId = (rateId: string): boolean =>
  rateId.startsWith(LOCAL_RATE_PREFIX) || rateId.startsWith(PICKUP_RATE_PREFIX)

const paise = z.number().int().min(0).max(100_000_000)

export const LocalDeliverySchema = z
  .object({
    enabled: z.boolean(),
    pincodes: z
      .array(
        z
          .string()
          .trim()
          .refine(isPincodePattern, 'PIN codes are six digits (560001) or a prefix and * (560*)'),
      )
      .max(2000)
      .default([]),
    pricePaise: paise.default(0),
    minOrderPaise: paise.nullable().default(null),
    freeAbovePaise: paise.nullable().default(null),
    instructions: z.string().trim().max(500).default(''),
  })
  .refine((d) => !d.enabled || d.pincodes.length > 0, {
    message: 'Add the PIN codes you deliver to',
    path: ['pincodes'],
  })
export type LocalDelivery = z.infer<typeof LocalDeliverySchema>

export const StorePickupSchema = z.object({
  enabled: z.boolean(),
  readyIn: z.string().trim().max(120).default(''),
  instructions: z.string().trim().max(500).default(''),
})
export type StorePickup = z.infer<typeof StorePickupSchema>

/** A location as the rule reads it. */
export type LocalOptionLocation = {
  id: string
  name: string
  active: boolean
  localDelivery: LocalDelivery | null
  storePickup: StorePickup | null
}

/** What a local option tells the order: kind, location and the shopper's instructions. */
export type LocalOptionInfo = {
  kind: 'local_delivery' | 'pickup'
  locationId: string
  locationName: string
  instructions: string
}

/** Names shown at checkout, from the storefront's copy (English by default). */
export type LocalOptionNames = {
  localDelivery: (location: string) => string
  pickup: (location: string) => string
}

export const DEFAULT_LOCAL_NAMES: LocalOptionNames = {
  localDelivery: (location) => `Local delivery from ${location}`,
  pickup: (location) => `Pickup at ${location}`,
}

/** One PIN code spelling for the rule, as zones use (`560 100` → `560100`). */
const cleanPin = (pincode: string) => pincode.replace(/[\s-]/g, '')

/** Whether local delivery from `d` reaches this PIN code. */
export const deliversTo = (d: Pick<LocalDelivery, 'pincodes'>, pincode: string): boolean =>
  d.pincodes.some((p) => pincodeMatches(p, cleanPin(pincode)))

const option = (
  info: LocalOptionInfo,
  name: string,
  listPricePaise: number,
  pricePaise: number,
): ShippingRateOption & { local: LocalOptionInfo } => ({
  rateId: `${info.kind === 'pickup' ? PICKUP_RATE_PREFIX : LOCAL_RATE_PREFIX}${info.locationId}`,
  name,
  zoneId: '',
  zoneName: info.locationName,
  listPricePaise,
  pricePaise,
  codSurchargePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  local: info,
})

/** The local delivery and pickup options for this address and order value (the rule above). */
export function localOptions(
  locations: readonly LocalOptionLocation[],
  to: ShippingDestination,
  valuePaise: number,
  names: LocalOptionNames = DEFAULT_LOCAL_NAMES,
): ShippingRateOption[] {
  if (destinationCountry(to) !== HOME_COUNTRY) return []
  const delivery: ShippingRateOption[] = []
  const pickup: ShippingRateOption[] = []
  for (const l of locations) {
    if (!l.active) continue
    const d = l.localDelivery
    if (d?.enabled && deliversTo(d, to.pincode)) {
      if (d.minOrderPaise === null || valuePaise >= d.minOrderPaise) {
        const free = d.freeAbovePaise !== null && valuePaise >= d.freeAbovePaise
        const info = {
          kind: 'local_delivery' as const,
          locationId: l.id,
          locationName: l.name,
          instructions: d.instructions,
        }
        delivery.push(
          option(info, names.localDelivery(l.name), d.pricePaise, free ? 0 : d.pricePaise),
        )
      }
    }
    const p = l.storePickup
    if (p?.enabled) {
      const instructions = [p.readyIn, p.instructions].filter(Boolean).join('. ')
      const info = { kind: 'pickup' as const, locationId: l.id, locationName: l.name, instructions }
      pickup.push(option(info, names.pickup(l.name), 0, 0))
    }
  }
  return [...delivery.sort((a, b) => a.pricePaise - b.pricePaise), ...pickup]
}

/**
 * The zone quote with the local options after its rates. No zones at all stays "not
 * configured" (shipping is free); an address no zone covers gets the local options alone.
 */
export function withLocalOptions(
  quote: ShippingQuote,
  local: readonly ShippingRateOption[],
): ShippingQuote {
  if (local.length === 0 || quote.kind === 'not_configured') return quote
  if (quote.kind === 'no_rates') return { kind: 'rates', options: [...local] }
  return { kind: 'rates', options: [...quote.options, ...local] }
}

/** The rate row id an order keeps: none for a local option (it has no row). */
export const rateRowId = (rateId: string, primary: (id: string) => string): string | null =>
  isLocalRateId(rateId) ? null : primary(rateId)

/** Read a stored location setting, null when unset or unreadable. */
export function parseLocalDelivery(raw: unknown): LocalDelivery | null {
  const r = LocalDeliverySchema.safeParse(raw)
  return raw && r.success ? r.data : null
}

export function parseStorePickup(raw: unknown): StorePickup | null {
  const r = StorePickupSchema.safeParse(raw)
  return raw && r.success ? r.data : null
}
