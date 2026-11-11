/** SOURCE OF TRUTH: shipping profiles in the database — WHAT: the General and custom profiles with their products, and the cart quote split by profile / WHY: the rule itself is pure, in profiles.ts */
import {
  cart,
  cartLine,
  collectionProduct,
  product,
  type StoreTx,
  shippingProfile,
  shippingProfileProduct,
  shippingProfileVariant,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, max } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount, subtotalPaise } from '../discounts/evaluate'
import { resolveCartDiscount } from '../discounts/resolve'
import { CommerceError } from '../errors'
import { localOptions, withLocalOptions } from './local-options'
import { loadLocalOptionLocations } from './local-service'
import { type ProfileProductEntry, profileProductEntries } from './profile-entries'
import { lineProfiles, profileProducts, syncProducts, syncVariants } from './profile-placement'

export { moveProductsToGeneral } from './profile-placement'

import {
  lineShips,
  profilesFreeShippingThreshold,
  quoteProfiles,
  type ShippingProfileInput,
  type ShippingProfileWrite,
  splitProfileParts,
} from './profiles'
import {
  type ShippingCartMeasure,
  type ShippingDestination,
  type ShippingQuote,
  zonesForMarkets,
} from './rates'
import {
  ensureGeneralProfile,
  GENERAL_PROFILE_NAME,
  listShippingZones,
  type ShippingProfileRow,
  type ShippingZoneWithRates,
  sellingCountries,
} from './rates-service'

/**
 * Settings › Shipping › profiles: the General profile (every product not placed elsewhere)
 * and custom profiles with their products, and the cart quote that splits lines by profile.
 * The pricing rule itself is pure, in `profiles.ts`.
 */

export type ShippingProfileSummary = ShippingProfileRow & {
  /** Products with at least one variant in it; null for General (every other product). */
  productCount: number | null
  zones: ShippingZoneWithRates[]
}

export type ShippingProfileDetail = ShippingProfileSummary & {
  /** Whole products in the profile. */
  productIds: string[]
  /** Variants placed in the profile on their own. */
  variantIds: string[]
  /** Every product with a variant in the profile, for the page's list. */
  entries: ProfileProductEntry[]
}

/** A zone's profile: its own, or General when it has none (zones from seeds and older code). */
const zoneProfileId = (zone: { profileId: string | null }, generalId: string) =>
  zone.profileId ?? generalId

/** Every profile with its zones and product count, General first. RLS scopes the rows. */
export async function listShippingProfiles(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingProfileSummary[]> {
  const general = await ensureGeneralProfile(tx, storeId)
  const rows = await tx
    .select()
    .from(shippingProfile)
    .orderBy(asc(shippingProfile.position), asc(shippingProfile.createdAt))
  const products = await profileProducts(tx)
  const zones = await listShippingZones(tx)
  return [...rows]
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map((p) => ({
      ...p,
      productCount: p.isDefault ? null : (products.get(p.id)?.size ?? 0),
      zones: zones.filter((z) => zoneProfileId(z, general.id) === p.id),
    }))
}

export async function getShippingProfile(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<ShippingProfileDetail | null> {
  const profiles = await listShippingProfiles(tx, storeId)
  const found = profiles.find((p) => p.id === id)
  if (!found) return null
  if (found.isDefault) return { ...found, productIds: [], variantIds: [], entries: [] }
  const products = await tx
    .select({ id: shippingProfileProduct.productId })
    .from(shippingProfileProduct)
    .where(eq(shippingProfileProduct.profileId, id))
  const variants = await tx
    .select({ id: shippingProfileVariant.variantId, productId: variant.productId })
    .from(shippingProfileVariant)
    .innerJoin(variant, eq(variant.id, shippingProfileVariant.variantId))
    .where(eq(shippingProfileVariant.profileId, id))
  const entries = await profileProductEntries(tx, id, [
    ...products.map((p) => p.id),
    ...variants.map((v) => v.productId),
  ])
  return {
    ...found,
    productIds: products.map((p) => p.id),
    variantIds: variants.map((v) => v.id),
    entries,
  }
}

export async function createShippingProfile(
  tx: StoreTx,
  storeId: string,
  input: ShippingProfileWrite,
): Promise<ShippingProfileDetail> {
  await ensureGeneralProfile(tx, storeId)
  const [last] = await tx.select({ n: max(shippingProfile.position) }).from(shippingProfile)
  const [made] = await tx
    .insert(shippingProfile)
    .values({ storeId, name: input.name, position: (last?.n ?? 0) + 1 })
    .returning({ id: shippingProfile.id })
  if (!made) throw new Error('shipping profile insert returned nothing')
  await syncProducts(tx, storeId, made.id, input.productIds)
  await syncVariants(tx, storeId, made.id, input.variantIds)
  return (await getShippingProfile(tx, storeId, made.id)) as ShippingProfileDetail
}

/**
 * Rename a profile and set its products and variants. General keeps every product and variant
 * not placed elsewhere.
 */
export async function updateShippingProfile(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: ShippingProfileWrite,
): Promise<ShippingProfileDetail> {
  const [row] = await tx
    .update(shippingProfile)
    .set({ name: input.name })
    .where(eq(shippingProfile.id, id))
    .returning({ id: shippingProfile.id, isDefault: shippingProfile.isDefault })
  if (!row) throw new CommerceError('NOT_FOUND', `Shipping profile ${id} not found`, { storeId })
  if (!row.isDefault) {
    await syncProducts(tx, storeId, id, input.productIds)
    await syncVariants(tx, storeId, id, input.variantIds)
  }
  return (await getShippingProfile(tx, storeId, id)) as ShippingProfileDetail
}

/**
 * Delete a custom profile with its zones and rates; its products and variants go back to their
 * product's profile or General. Orders
 * keep their own snapshot of the rate they paid. General cannot be deleted.
 */
export async function deleteShippingProfile(tx: StoreTx, id: string): Promise<boolean> {
  const rows = await tx
    .delete(shippingProfile)
    .where(and(eq(shippingProfile.id, id), eq(shippingProfile.isDefault, false)))
    .returning({ id: shippingProfile.id })
  return rows.length > 0
}

/** Products of the given collections, for "add a collection's products" to a profile. */
export async function collectionProductIds(
  tx: StoreTx,
  collectionIds: readonly string[],
): Promise<string[]> {
  if (collectionIds.length === 0) return []
  const rows = await tx
    .selectDistinct({ id: collectionProduct.productId })
    .from(collectionProduct)
    .where(inArray(collectionProduct.collectionId, [...collectionIds]))
  return rows.map((r) => r.id)
}

/**
 * The profiles in the shape the pure engine takes. Read-only: a store without a General row
 * yet gets one in memory (empty id), holding the zones that have no profile.
 */
async function loadRateProfiles(tx: StoreTx): Promise<ShippingProfileInput[]> {
  const rows = await tx.select().from(shippingProfile)
  const general = rows.find((p) => p.isDefault) ?? {
    id: '',
    name: GENERAL_PROFILE_NAME,
    isDefault: true,
    position: 0,
  }
  const [listed, selling] = await Promise.all([listShippingZones(tx), sellingCountries(tx)])
  const zones = zonesForMarkets(listed, selling)
  const all = rows.some((p) => p.isDefault) ? rows : [general, ...rows]
  return all.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    position: p.position,
    zones: zones.filter((z) => zoneProfileId(z, general.id) === p.id),
  }))
}

/** A cart or order line as the profile quote needs it. */
export type ProfileQuoteLine = {
  productId: string
  variantId: string
  quantity: number
  unitPricePaise: number
  weightGrams: number | null
  giftCard: boolean
  /** The variant's "requires shipping"; false leaves the line out of the quote. */
  requiresShipping: boolean
}

/**
 * Quote `lines` going to `to`, split by profile (`splitProfileParts`, `quoteProfiles`).
 * `valuePaise` is the whole cart after discounts; with several profiles, or lines that do not
 * ship, each profile takes its share in proportion to its subtotal. A cart whose every line
 * ships in one profile is priced on the whole cart, exactly as before profiles. A cart with
 * nothing to ship is `not_configured`: no charge and no option.
 */
export async function quoteProfileLines(
  tx: StoreTx,
  lines: readonly ProfileQuoteLine[],
  valuePaise: number,
  to: ShippingDestination,
): Promise<{ quote: ShippingQuote; measure: ShippingCartMeasure }> {
  const profiles = await loadRateProfiles(tx)
  const general = profiles.find((p) => p.isDefault) as ShippingProfileInput
  const profileOf = await lineProfiles(tx, lines.filter(lineShips), general.id)
  const split = splitProfileParts(lines, valuePaise, profileOf)
  if (!split.measure) {
    return { quote: { kind: 'not_configured' }, measure: { valuePaise: 0, weightGrams: 0 } }
  }
  // Local delivery and pickup in store at the store's locations come after the zone rates.
  const local = localOptions(await loadLocalOptionLocations(tx), to, split.measure.valuePaise)
  return {
    quote: withLocalOptions(quoteProfiles(profiles, split.parts, to), local),
    measure: split.measure,
  }
}

/**
 * What the cart says before there is an address: whether the store charges for shipping,
 * and the order value from which it is free everywhere for the cart's products (their
 * profiles' thresholds; General's for an empty cart), null when there is no such promise.
 */
export async function cartShippingHintFor(
  tx: StoreTx,
  cartId: string | null,
): Promise<{ charged: boolean; freeAbovePaise: number | null }> {
  const profiles = await loadRateProfiles(tx)
  const charged = profiles.some((p) => p.zones.length > 0)
  if (!charged) return { charged, freeAbovePaise: null }
  const general = profiles.find((p) => p.isDefault) as ShippingProfileInput
  const lines = cartId
    ? await tx
        .select({
          variantId: cartLine.variantId,
          productId: variant.productId,
          giftCard: product.isGiftCard,
          requiresShipping: variant.requiresShipping,
        })
        .from(cartLine)
        .innerJoin(variant, eq(variant.id, cartLine.variantId))
        .innerJoin(product, eq(product.id, variant.productId))
        .where(eq(cartLine.cartId, cartId))
    : []
  const shipped = lines.filter(lineShips)
  // A cart of only things that never ship (a service, a download) has no shipping to promise.
  if (lines.length > 0 && shipped.length === 0) return { charged: false, freeAbovePaise: null }
  const profileOf = await lineProfiles(tx, shipped, general.id)
  const ids = [...new Set(shipped.map(profileOf))]
  return { charged, freeAbovePaise: profilesFreeShippingThreshold(profiles, ids) }
}

export type CartShippingQuote = ShippingQuote & {
  /** True when the discount in force makes shipping free (every option is then ₹0). */
  freeShippingDiscount: boolean
  /** The value (after the discount) and weight the rates were priced on; null when nothing ships. */
  measure?: ShippingCartMeasure | null | undefined
  /** Shipping after the discount in force (a free-shipping discount and its cap). */
  afterDiscount?: ((shippingPaise: number) => number) | undefined
}

/**
 * Rates for a cart going to `to`, priced the way `placeOrder` prices them:
 * bands and thresholds read the subtotal after the discount in force, lines are
 * split by shipping profile (`quoteProfileLines`), and a free-shipping discount
 * zeroes the price. A basket of only gift cards, or of variants that need no shipping, ships
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
      variantId: cartLine.variantId,
      weightGrams: variant.weightGrams,
      giftCard: product.isGiftCard,
      requiresShipping: variant.requiresShipping,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartLine.cartId, cartId))
  // Gift cards and variants that need no shipping: nothing to charge for, nothing to pick.
  if (!c || !lines.some(lineShips)) {
    return { kind: 'not_configured', freeShippingDiscount: false }
  }
  const { outcome } = await resolveCartDiscount(ctx, cartId, c.discountCode, {
    ...opts,
    stateCode: to.stateCode,
  })
  const { discountedSubtotalPaise } = applyDiscount(subtotalPaise(lines), 0, outcome)
  const { quote, measure } = await quoteProfileLines(ctx.tx, lines, discountedSubtotalPaise, to)
  const free = outcome?.freeShipping === true
  const afterDiscount = (paise: number) => applyDiscount(0, paise, outcome).shippingPaise
  if (quote.kind !== 'rates' || !free) {
    return { ...quote, freeShippingDiscount: free, measure, afterDiscount }
  }
  // A rate above the discount's "exclude rates over" cap keeps its price (applyDiscount).
  return {
    kind: 'rates',
    options: quote.options.map((o) => ({
      ...o,
      pricePaise: applyDiscount(0, o.pricePaise, outcome).shippingPaise,
      // The parts follow the free shipping too, so the highest part is still the option's price.
      ...(o.parts
        ? {
            parts: o.parts.map((p) => ({
              ...p,
              pricePaise: applyDiscount(0, p.pricePaise, outcome).shippingPaise,
            })),
          }
        : {}),
    })),
    freeShippingDiscount: true,
    measure,
    afterDiscount,
  }
}
