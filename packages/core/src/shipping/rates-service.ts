import {
  cartLine,
  market,
  marketRegion,
  type StoreTx,
  shippingProfile,
  shippingRate,
  shippingZone,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull, max, notInArray } from 'drizzle-orm'
import { checkoutCountries } from '../checkout/address-abroad'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  freeShippingThreshold,
  HOME_COUNTRY,
  type ShippingZoneInput,
  type ShippingZoneWrite,
  zonesForMarkets,
} from './rates'

export const GENERAL_PROFILE_NAME = 'General'

/** The store's General profile, made on first use (stores created after migration 0193). */
export async function ensureGeneralProfile(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingProfileRow> {
  const [found] = await tx.select().from(shippingProfile).where(eq(shippingProfile.isDefault, true))
  if (found) return found
  await tx
    .insert(shippingProfile)
    .values({ storeId, name: GENERAL_PROFILE_NAME, isDefault: true, position: 0 })
    .onConflictDoNothing()
  const [made] = await tx.select().from(shippingProfile).where(eq(shippingProfile.isDefault, true))
  if (!made) throw new Error('General shipping profile insert returned nothing')
  // Zones written before the store had a General profile belong to it.
  await tx.update(shippingZone).set({ profileId: made.id }).where(isNull(shippingZone.profileId))
  return made
}

export type ShippingProfileRow = typeof shippingProfile.$inferSelect
export type ShippingZoneRow = typeof shippingZone.$inferSelect
export type ShippingRateRow = typeof shippingRate.$inferSelect
export type ShippingZoneWithRates = ShippingZoneRow & { rates: ShippingRateRow[] }

/**
 * The countries checkout offers in its Country picker: India, then every country a shipping
 * zone names (all of them with a "Rest of world" zone). RLS scopes the zones.
 */
export async function storeCheckoutCountries(tx: StoreTx): Promise<string[]> {
  const [zones, selling] = await Promise.all([
    tx.select({ countryCodes: shippingZone.countryCodes }).from(shippingZone),
    sellingCountries(tx),
  ])
  return checkoutCountries(zonesForMarkets(zones, selling).map((z) => z.countryCodes))
}

/**
 * Countries in the store's enabled markets, India always among them; null for a store with
 * no markets yet (nothing to limit by). RLS scopes the rows.
 */
export async function sellingCountries(tx: StoreTx): Promise<Set<string> | null> {
  const rows = await tx
    .select({ country: marketRegion.countryCode, enabled: market.enabled })
    .from(market)
    .leftJoin(marketRegion, eq(marketRegion.marketId, market.id))
  if (rows.length === 0) return null
  const codes = rows.flatMap((r) => (r.enabled && r.country ? [r.country] : []))
  return new Set([HOME_COUNTRY, ...codes])
}

/** Every zone of the store with its rates, in the merchant's order. RLS scopes the rows. */
export async function listShippingZones(tx: StoreTx): Promise<ShippingZoneWithRates[]> {
  const zones = await tx
    .select()
    .from(shippingZone)
    .orderBy(asc(shippingZone.position), asc(shippingZone.id))
  if (zones.length === 0) return []
  const rates = await tx
    .select()
    .from(shippingRate)
    .where(
      inArray(
        shippingRate.zoneId,
        zones.map((z) => z.id),
      ),
    )
    .orderBy(asc(shippingRate.position), asc(shippingRate.id))
  return zones.map((z) => ({ ...z, rates: rates.filter((r) => r.zoneId === z.id) }))
}

export async function getShippingZone(
  tx: StoreTx,
  id: string,
): Promise<ShippingZoneWithRates | null> {
  const [zone] = await tx.select().from(shippingZone).where(eq(shippingZone.id, id))
  if (!zone) return null
  const rates = await tx
    .select()
    .from(shippingRate)
    .where(eq(shippingRate.zoneId, id))
    .orderBy(asc(shippingRate.position), asc(shippingRate.id))
  return { ...zone, rates }
}

/** A zone as the service saves it; no countries means India, as before country zones. */
export type ShippingZoneSave = Omit<ShippingZoneWrite, 'countryCodes'> & {
  countryCodes?: string[] | undefined
}

/** Where a zone ships: its countries, and the states and PIN rules only when India is one. */
const coverage = (input: ShippingZoneSave) => {
  // A caller that skipped the schema (seeds, the importer's executor) still means India.
  const listed = input.countryCodes?.length ? input.countryCodes : [HOME_COUNTRY]
  const countryCodes = [...new Set(listed)]
  const india = countryCodes.includes(HOME_COUNTRY)
  return {
    countryCodes,
    stateCodes: india ? [...new Set(input.stateCodes)] : [],
    pincodeRules: india ? input.pincodeRules : [],
  }
}

const rateValues = (r: ShippingZoneWrite['rates'][number], position: number) => ({
  name: r.name,
  condition: r.condition,
  minValue: r.condition === 'none' ? null : r.minValue,
  maxValue: r.condition === 'none' ? null : r.maxValue,
  pricePaise: r.pricePaise,
  freeAbovePaise: r.freeAbovePaise,
  codSurchargePaise: r.codSurchargePaise,
  minTransitDays: r.minTransitDays,
  maxTransitDays: r.maxTransitDays,
  position,
})

/** Replace a zone's rates with `rates`: ids that exist are updated, the rest inserted, missing ones removed. */
async function syncRates(
  tx: StoreTx,
  storeId: string,
  zoneId: string,
  rates: ShippingZoneWrite['rates'],
): Promise<void> {
  const existing = await tx
    .select({ id: shippingRate.id })
    .from(shippingRate)
    .where(eq(shippingRate.zoneId, zoneId))
  const known = new Set(existing.map((r) => r.id))
  const kept = rates.flatMap((r) => (r.id && known.has(r.id) ? [r.id] : []))
  await tx
    .delete(shippingRate)
    .where(
      kept.length
        ? and(eq(shippingRate.zoneId, zoneId), notInArray(shippingRate.id, kept))
        : eq(shippingRate.zoneId, zoneId),
    )
  for (const [i, r] of rates.entries()) {
    if (r.id && known.has(r.id)) {
      await tx
        .update(shippingRate)
        .set({ ...rateValues(r, i), updatedAt: new Date() })
        .where(eq(shippingRate.id, r.id))
    } else {
      await tx.insert(shippingRate).values({ storeId, zoneId, ...rateValues(r, i) })
    }
  }
}

export async function createShippingZone(
  tx: StoreTx,
  storeId: string,
  input: ShippingZoneSave,
): Promise<ShippingZoneWithRates> {
  const profileId = input.profileId ?? (await ensureGeneralProfile(tx, storeId)).id
  const [last] = await tx.select({ n: max(shippingZone.position) }).from(shippingZone)
  const [zone] = await tx
    .insert(shippingZone)
    .values({
      storeId,
      profileId,
      name: input.name,
      ...coverage(input),
      position: (last?.n ?? -1) + 1,
    })
    .returning()
  if (!zone) throw new Error('shipping zone insert returned nothing')
  await syncRates(tx, storeId, zone.id, input.rates)
  return (await getShippingZone(tx, zone.id)) as ShippingZoneWithRates
}

export async function updateShippingZone(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: ShippingZoneSave,
): Promise<ShippingZoneWithRates> {
  const [zone] = await tx
    .update(shippingZone)
    .set({
      name: input.name,
      ...coverage(input),
      updatedAt: new Date(),
    })
    .where(eq(shippingZone.id, id))
    .returning({ id: shippingZone.id })
  if (!zone) throw new CommerceError('NOT_FOUND', `Shipping zone ${id} not found`, { storeId })
  await syncRates(tx, storeId, id, input.rates)
  return (await getShippingZone(tx, id)) as ShippingZoneWithRates
}

/** Delete a zone and its rates. Orders keep their own snapshot of the rate they paid. */
export async function deleteShippingZone(tx: StoreTx, id: string): Promise<boolean> {
  const rows = await tx
    .delete(shippingZone)
    .where(eq(shippingZone.id, id))
    .returning({ id: shippingZone.id })
  return rows.length > 0
}

/**
 * The General profile's zones (every product not in a custom profile), in the shape the pure
 * rate engine takes. A cart's quote splits lines by profile (`quoteProfileLines`).
 */
export async function loadRateZones(tx: StoreTx): Promise<ShippingZoneInput[]> {
  const [general] = await tx
    .select({ id: shippingProfile.id })
    .from(shippingProfile)
    .where(eq(shippingProfile.isDefault, true))
  const [zones, selling] = await Promise.all([listShippingZones(tx), sellingCountries(tx)])
  return zonesForMarkets(zones, selling).filter(
    (z) => z.profileId === null || z.profileId === general?.id,
  )
}

/** The store-wide free-shipping threshold for the cart line, or null. */
export async function storeFreeShippingThreshold(tx: StoreTx): Promise<number | null> {
  return freeShippingThreshold(await loadRateZones(tx))
}

/** Grams in the cart: variant weight × quantity, unknown weights counted as 0. */
export async function cartWeightGrams(ctx: StoreContext, cartId: string): Promise<number> {
  const rows = await ctx.tx
    .select({ quantity: cartLine.quantity, grams: variant.weightGrams })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .where(eq(cartLine.cartId, cartId))
  return rows.reduce((sum, r) => sum + r.quantity * (r.grams ?? 0), 0)
}
