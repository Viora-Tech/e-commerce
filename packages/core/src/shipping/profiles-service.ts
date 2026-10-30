import {
  cart,
  cartLine,
  collectionProduct,
  product,
  type StoreTx,
  shippingProfile,
  shippingProfileProduct,
  variant,
} from '@commerce/db'
import { and, asc, count, eq, inArray, max, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount, subtotalPaise } from '../discounts/evaluate'
import { resolveCartDiscount } from '../discounts/resolve'
import { CommerceError } from '../errors'
import {
  type ProfileCartPart,
  profilesFreeShippingThreshold,
  quoteProfiles,
  type ShippingProfileInput,
  type ShippingProfileWrite,
  splitValue,
} from './profiles'
import type { ShippingCartMeasure, ShippingDestination, ShippingQuote } from './rates'
import {
  ensureGeneralProfile,
  GENERAL_PROFILE_NAME,
  listShippingZones,
  type ShippingProfileRow,
  type ShippingZoneWithRates,
} from './rates-service'

/**
 * Settings › Shipping › profiles: the General profile (every product not placed elsewhere)
 * and custom profiles with their products, and the cart quote that splits lines by profile.
 * The pricing rule itself is pure, in `profiles.ts`.
 */

export type ShippingProfileSummary = ShippingProfileRow & {
  /** Products placed in it; null for General (every other product). */
  productCount: number | null
  zones: ShippingZoneWithRates[]
}
export type ShippingProfileDetail = ShippingProfileSummary & { productIds: string[] }

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
  const counts = await tx
    .select({ profileId: shippingProfileProduct.profileId, n: count() })
    .from(shippingProfileProduct)
    .groupBy(shippingProfileProduct.profileId)
  const zones = await listShippingZones(tx)
  return [...rows]
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map((p) => ({
      ...p,
      productCount: p.isDefault ? null : (counts.find((c) => c.profileId === p.id)?.n ?? 0),
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
  const products = found.isDefault
    ? []
    : await tx
        .select({ id: shippingProfileProduct.productId })
        .from(shippingProfileProduct)
        .where(eq(shippingProfileProduct.profileId, id))
  return { ...found, productIds: products.map((p) => p.id) }
}

/** Put exactly `productIds` in a custom profile; products in another profile move here. */
async function syncProducts(
  tx: StoreTx,
  storeId: string,
  profileId: string,
  productIds: readonly string[],
): Promise<void> {
  const wanted = [...new Set(productIds)]
  await tx
    .delete(shippingProfileProduct)
    .where(
      wanted.length
        ? and(
            eq(shippingProfileProduct.profileId, profileId),
            notInArray(shippingProfileProduct.productId, wanted),
          )
        : eq(shippingProfileProduct.profileId, profileId),
    )
  if (wanted.length === 0) return
  // Only this store's products (RLS hides the rest), so a foreign id is dropped, not linked.
  const known = await tx.select({ id: product.id }).from(product).where(inArray(product.id, wanted))
  if (known.length === 0) return
  await tx
    .insert(shippingProfileProduct)
    .values(known.map((p) => ({ storeId, profileId, productId: p.id })))
    .onConflictDoUpdate({
      target: [shippingProfileProduct.storeId, shippingProfileProduct.productId],
      set: { profileId },
    })
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
  return (await getShippingProfile(tx, storeId, made.id)) as ShippingProfileDetail
}

/** Rename a profile and set its products. General keeps every product not placed elsewhere. */
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
  if (!row.isDefault) await syncProducts(tx, storeId, id, input.productIds)
  return (await getShippingProfile(tx, storeId, id)) as ShippingProfileDetail
}

/**
 * Delete a custom profile with its zones and rates; its products go back to General. Orders
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
export async function loadRateProfiles(tx: StoreTx): Promise<ShippingProfileInput[]> {
  const rows = await tx.select().from(shippingProfile)
  const general = rows.find((p) => p.isDefault) ?? {
    id: '',
    name: GENERAL_PROFILE_NAME,
    isDefault: true,
    position: 0,
  }
  const zones = await listShippingZones(tx)
  const all = rows.some((p) => p.isDefault) ? rows : [general, ...rows]
  return all.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    position: p.position,
    zones: zones.filter((z) => zoneProfileId(z, general.id) === p.id),
  }))
}

/** The custom profile each product is in; products missing from the map ship under General. */
export async function productProfiles(
  tx: StoreTx,
  productIds: readonly string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map()
  const rows = await tx
    .select({
      productId: shippingProfileProduct.productId,
      profileId: shippingProfileProduct.profileId,
    })
    .from(shippingProfileProduct)
    .where(inArray(shippingProfileProduct.productId, [...new Set(productIds)]))
  return new Map(rows.map((r) => [r.productId, r.profileId]))
}

/** A cart or order line as the profile quote needs it. */
export type ProfileQuoteLine = {
  productId: string
  quantity: number
  unitPricePaise: number
  weightGrams: number | null
  giftCard: boolean
}

/**
 * Quote `lines` going to `to`, split by profile (`quoteProfiles`). `valuePaise` is the whole
 * cart after discounts; with several profiles it is shared out in proportion to each one's
 * subtotal. A cart from one profile is priced on the whole cart, exactly as before profiles.
 */
export async function quoteProfileLines(
  tx: StoreTx,
  lines: readonly ProfileQuoteLine[],
  valuePaise: number,
  to: ShippingDestination,
): Promise<{ quote: ShippingQuote; measure: ShippingCartMeasure }> {
  const weightOf = (ls: readonly ProfileQuoteLine[]) =>
    ls.reduce((sum, l) => sum + l.quantity * (l.weightGrams ?? 0), 0)
  const measure: ShippingCartMeasure = { valuePaise, weightGrams: weightOf(lines) }
  const profiles = await loadRateProfiles(tx)
  const general = profiles.find((p) => p.isDefault) as ShippingProfileInput
  const shipped = lines.filter((l) => !l.giftCard)
  const placed = await productProfiles(
    tx,
    shipped.map((l) => l.productId),
  )
  const groups = new Map<string, ProfileQuoteLine[]>()
  for (const l of shipped) {
    const id = placed.get(l.productId) ?? general.id
    groups.set(id, [...(groups.get(id) ?? []), l])
  }
  const entries = [...groups]
  if (entries.length <= 1) {
    const parts: ProfileCartPart[] = [{ profileId: entries[0]?.[0] ?? general.id, measure }]
    return { quote: quoteProfiles(profiles, parts, to), measure }
  }
  const values = splitValue(
    valuePaise,
    entries.map(([, ls]) => ls.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)),
  )
  const parts = entries.map(([profileId, ls], i) => ({
    profileId,
    measure: { valuePaise: values[i] ?? 0, weightGrams: weightOf(ls) },
  }))
  return { quote: quoteProfiles(profiles, parts, to), measure }
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
  const productIds = cartId
    ? (
        await tx
          .selectDistinct({ id: variant.productId })
          .from(cartLine)
          .innerJoin(variant, eq(variant.id, cartLine.variantId))
          .innerJoin(product, eq(product.id, variant.productId))
          .where(and(eq(cartLine.cartId, cartId), eq(product.isGiftCard, false)))
      ).map((r) => r.id)
    : []
  const placed = await productProfiles(tx, productIds)
  const ids = productIds.map((id) => placed.get(id) ?? general.id)
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
 * zeroes the price. A basket of only gift cards ships nothing.
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
      weightGrams: variant.weightGrams,
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
      // The parts follow the free shipping too, so they still add up to the option.
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
