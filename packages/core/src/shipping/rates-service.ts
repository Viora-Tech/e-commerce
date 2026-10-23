import {
  cart,
  cartLine,
  product,
  type StoreTx,
  shippingRate,
  shippingZone,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, max, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount, subtotalPaise } from '../discounts/evaluate'
import { resolveCartDiscount } from '../discounts/resolve'
import { CommerceError } from '../errors'
import {
  freeShippingThreshold,
  quoteShipping,
  type ShippingCartMeasure,
  type ShippingDestination,
  type ShippingQuote,
  type ShippingZoneInput,
  type ShippingZoneWrite,
} from './rates'

export type ShippingZoneRow = typeof shippingZone.$inferSelect
export type ShippingRateRow = typeof shippingRate.$inferSelect
export type ShippingZoneWithRates = ShippingZoneRow & { rates: ShippingRateRow[] }

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
  input: ShippingZoneWrite,
): Promise<ShippingZoneWithRates> {
  const [last] = await tx.select({ n: max(shippingZone.position) }).from(shippingZone)
  const [zone] = await tx
    .insert(shippingZone)
    .values({
      storeId,
      name: input.name,
      stateCodes: [...new Set(input.stateCodes)],
      pincodeRules: input.pincodeRules,
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
  input: ShippingZoneWrite,
): Promise<ShippingZoneWithRates> {
  const [zone] = await tx
    .update(shippingZone)
    .set({
      name: input.name,
      stateCodes: [...new Set(input.stateCodes)],
      pincodeRules: input.pincodeRules,
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

/** Zones in the shape the pure rate engine takes. */
export async function loadRateZones(tx: StoreTx): Promise<ShippingZoneInput[]> {
  return listShippingZones(tx)
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

export type CartShippingQuote = ShippingQuote & {
  /** True when the discount in force makes shipping free (every option is then ₹0). */
  freeShippingDiscount: boolean
}

/**
 * Rates for a cart going to `to`, priced the way `placeOrder` prices them:
 * bands and thresholds read the subtotal after the discount in force, and a
 * free-shipping discount zeroes the price. A basket of only gift cards ships
 * nothing.
 */
export async function quoteCartShipping(
  ctx: StoreContext,
  cartId: string,
  to: ShippingDestination,
  opts: { email?: string | null | undefined } = {},
): Promise<CartShippingQuote> {
  const [c] = await ctx.tx
    .select({ discountCode: cart.discountCode })
    .from(cart)
    .where(eq(cart.id, cartId))
  const lines = await ctx.tx
    .select({
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      productId: variant.productId,
      giftCard: product.isGiftCard,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartLine.cartId, cartId))
  if (!c || lines.length === 0 || lines.every((l) => l.giftCard)) {
    return { kind: 'not_configured', freeShippingDiscount: false }
  }
  const { outcome } = await resolveCartDiscount(ctx, cartId, c.discountCode, {
    ...opts,
    stateCode: to.stateCode,
  })
  const { discountedSubtotalPaise } = applyDiscount(subtotalPaise(lines), 0, outcome)
  const measure: ShippingCartMeasure = {
    valuePaise: discountedSubtotalPaise,
    weightGrams: await cartWeightGrams(ctx, cartId),
  }
  const quote = quoteShipping(await loadRateZones(ctx.tx), to, measure)
  const free = outcome?.freeShipping === true
  if (quote.kind !== 'rates' || !free) return { ...quote, freeShippingDiscount: free }
  // A rate above the discount's "exclude rates over" cap keeps its price (applyDiscount).
  return {
    kind: 'rates',
    options: quote.options.map((o) => ({
      ...o,
      pricePaise: applyDiscount(0, o.pricePaise, outcome).shippingPaise,
    })),
    freeShippingDiscount: true,
  }
}
