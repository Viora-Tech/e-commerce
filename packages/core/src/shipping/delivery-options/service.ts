/** SOURCE OF TRUTH: the Delivery options app's stored settings — WHAT: loads a store's options,
 * product route rules and route settings for the engine, saves and reorders them, and reads
 * the rule facts (collections, tags, type) of the products in a cart / WHY: checkout, place
 * order, booking, Try a PIN and the admin pages read and write the same rows the same way.
 */
import { createHash } from 'node:crypto'
import {
  cartLine,
  collectionProduct,
  deliveryOption,
  deliveryRouteRule,
  deliveryRouteSetting,
  product,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import { asc, eq, inArray } from 'drizzle-orm'
import { lockStoreApps } from '../../apps/locked'
import {
  type AppsSettings,
  appSettingsOf,
  parseAppsSettings,
  withAppSettings,
} from '../../apps/settings'
import { storeAppsRow } from '../../apps/store-apps'
import { type CartParcel, cartParcel } from '../parcel'
import { lineShips } from '../profiles'
import type { ShippingSettings } from '../settings'
import {
  CostCardSchema,
  DELIVERY_OPTIONS_APP_ID,
  type DeliveryConfig,
  type DeliveryLayout,
  type DeliveryOption,
  DeliveryOptionInputSchema,
  PRESET_OPTIONS,
  type RouteRule,
  RouteRuleInputSchema,
  type RouteSetting,
  RouteSettingInputSchema,
} from './config'
import { type ProtectCard, ProtectCardSchema, parseProtectCard } from './protect'
import type { CartItemFacts } from './rules'

/** Whether the store installed the app. Options without the app change nothing. */
export async function deliveryOptionsInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const s = await storeAppsRow(tx, storeId)
  return parseAppsSettings(s.apps).installed.includes(DELIVERY_OPTIONS_APP_ID)
}

function toOption(row: typeof deliveryOption.$inferSelect): DeliveryOption | null {
  const parsed = DeliveryOptionInputSchema.safeParse({ ...(row.config as object), name: row.name })
  return parsed.success ? { ...parsed.data, id: row.id, position: row.position } : null
}

function toRule(row: typeof deliveryRouteRule.$inferSelect): RouteRule | null {
  const parsed = RouteRuleInputSchema.safeParse({ ...(row.config as object), name: row.name })
  return parsed.success ? { ...parsed.data, id: row.id, position: row.position } : null
}

function toSetting(row: typeof deliveryRouteSetting.$inferSelect): RouteSetting {
  const card = CostCardSchema.safeParse(row.costCard)
  return {
    key: row.key,
    insures: row.insures,
    insurancePercent: row.insuranceBps === null ? null : row.insuranceBps / 100,
    insuranceMinPaise: row.insuranceMinPaise,
    costCard: card.success ? card.data : null,
    enabled: row.enabled,
    showName: row.showName,
  }
}

/** The app's own entry in `store.apps.settings`; it holds the Delhivery Protect card. */
const protectCardOf = (apps: AppsSettings): ProtectCard => {
  const own = appSettingsOf(apps, DELIVERY_OPTIONS_APP_ID)
  return parseProtectCard(
    own && typeof own === 'object' ? (own as { protect?: unknown }).protect : null,
  )
}

/** The checkout layout saved in the app's own entry; anything else (or nothing) is `fixed`. */
const layoutOf = (apps: AppsSettings): DeliveryLayout => {
  const own = appSettingsOf(apps, DELIVERY_OPTIONS_APP_ID)
  const raw = own && typeof own === 'object' ? (own as { layout?: unknown }).layout : null
  return raw === 'list' ? 'list' : 'fixed'
}

/** The app's own settings: the Delhivery Protect card (Delhivery's defaults when the merchant
 *  saved none) and the checkout layout. */
async function loadOwnSettings(
  tx: StoreTx,
  storeId: string,
): Promise<{ protect: ProtectCard; layout: DeliveryLayout }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return { protect: protectCardOf(apps), layout: layoutOf(apps) }
}

/** Set how checkout shows the options (`fixed` or the courier `list`), leaving the rest alone. */
export async function saveDeliveryLayout(
  tx: StoreTx,
  storeId: string,
  layout: DeliveryLayout,
): Promise<DeliveryLayout> {
  const apps = await lockStoreApps(tx, storeId)
  const own = appSettingsOf(apps, DELIVERY_OPTIONS_APP_ID)
  const next = { ...(own && typeof own === 'object' ? own : {}), layout }
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, DELIVERY_OPTIONS_APP_ID, next) })
    .where(eq(store.id, storeId))
  return layout
}

/** Replace the Protect card, leaving the install list and other apps' settings alone. */
export async function saveProtectCard(
  tx: StoreTx,
  storeId: string,
  raw: unknown,
): Promise<ProtectCard> {
  const card = ProtectCardSchema.parse(raw)
  // About to write store.apps back: hold the row lock first, so no other writer is lost.
  const apps = await lockStoreApps(tx, storeId)
  const own = appSettingsOf(apps, DELIVERY_OPTIONS_APP_ID)
  const next = { ...(own && typeof own === 'object' ? own : {}), protect: card }
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, DELIVERY_OPTIONS_APP_ID, next) })
    .where(eq(store.id, storeId))
  return card
}

/** Everything the engine reads. `version` changes whenever any of it does. */
export async function loadDeliveryConfig(tx: StoreTx, storeId: string): Promise<DeliveryConfig> {
  const [options, rules, settings, own] = await Promise.all([
    tx.select().from(deliveryOption).orderBy(asc(deliveryOption.position), asc(deliveryOption.id)),
    tx
      .select()
      .from(deliveryRouteRule)
      .orderBy(asc(deliveryRouteRule.position), asc(deliveryRouteRule.id)),
    tx.select().from(deliveryRouteSetting).orderBy(asc(deliveryRouteSetting.key)),
    loadOwnSettings(tx, storeId),
  ])
  const config = {
    options: options.flatMap((r) => toOption(r) ?? []),
    rules: rules.flatMap((r) => toRule(r) ?? []),
    routeSettings: settings.map(toSetting),
    protect: own.protect,
    // `fixed` stays out of the object, so a store that never chose keeps its config version.
    ...(own.layout === 'list' ? { layout: own.layout } : {}),
  }
  const version = createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 16)
  return { ...config, version }
}

/** The app is on for checkout: installed, with at least one enabled option. */
export async function activeDeliveryConfig(
  tx: StoreTx,
  storeId: string,
): Promise<DeliveryConfig | null> {
  if (!(await deliveryOptionsInstalled(tx, storeId))) return null
  const config = await loadDeliveryConfig(tx, storeId)
  return config.options.some((o) => o.enabled) ? config : null
}

export async function saveDeliveryOption(
  tx: StoreTx,
  storeId: string,
  id: string | null,
  raw: unknown,
): Promise<DeliveryOption> {
  const input = DeliveryOptionInputSchema.parse(raw)
  const { name, ...config } = input
  if (id) {
    const [row] = await tx
      .update(deliveryOption)
      .set({ name, config, updatedAt: new Date() })
      .where(eq(deliveryOption.id, id))
      .returning()
    if (!row) throw new Error('This delivery option no longer exists.')
    return toOption(row) as DeliveryOption
  }
  const existing = await tx.select({ position: deliveryOption.position }).from(deliveryOption)
  const position = existing.reduce((m, r) => Math.max(m, r.position + 1), 0)
  const [row] = await tx
    .insert(deliveryOption)
    .values({ storeId, name, config, position })
    .returning()
  return toOption(row as typeof deliveryOption.$inferSelect) as DeliveryOption
}

export async function deleteDeliveryOption(tx: StoreTx, id: string): Promise<void> {
  await tx.delete(deliveryOption).where(eq(deliveryOption.id, id))
}

/** Standard (cheapest, COD) + Express (fastest, prepaid), when the store has no options yet. */
export async function addPresetOptions(tx: StoreTx, storeId: string): Promise<DeliveryOption[]> {
  const out: DeliveryOption[] = []
  for (const preset of PRESET_OPTIONS) out.push(await saveDeliveryOption(tx, storeId, null, preset))
  return out
}

async function reorder(
  tx: StoreTx,
  table: typeof deliveryOption | typeof deliveryRouteRule,
  ids: readonly string[],
): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await tx.update(table).set({ position }).where(eq(table.id, id))
  }
}

export const reorderDeliveryOptions = (tx: StoreTx, ids: readonly string[]) =>
  reorder(tx, deliveryOption, ids)

export async function saveRouteRule(
  tx: StoreTx,
  storeId: string,
  id: string | null,
  raw: unknown,
): Promise<RouteRule> {
  const input = RouteRuleInputSchema.parse(raw)
  const { name, ...config } = input
  if (id) {
    const [row] = await tx
      .update(deliveryRouteRule)
      .set({ name, config, updatedAt: new Date() })
      .where(eq(deliveryRouteRule.id, id))
      .returning()
    if (!row) throw new Error('This route rule no longer exists.')
    return toRule(row) as RouteRule
  }
  const existing = await tx.select({ position: deliveryRouteRule.position }).from(deliveryRouteRule)
  const position = existing.reduce((m, r) => Math.max(m, r.position + 1), 0)
  const [row] = await tx
    .insert(deliveryRouteRule)
    .values({ storeId, name, config, position })
    .returning()
  return toRule(row as typeof deliveryRouteRule.$inferSelect) as RouteRule
}

export async function deleteRouteRule(tx: StoreTx, id: string): Promise<void> {
  await tx.delete(deliveryRouteRule).where(eq(deliveryRouteRule.id, id))
}

export const reorderRouteRules = (tx: StoreTx, ids: readonly string[]) =>
  reorder(tx, deliveryRouteRule, ids)

/** One route's (or one carrier-and-channel's) settings, replacing what was saved. */
export async function saveRouteSetting(
  tx: StoreTx,
  storeId: string,
  raw: unknown,
): Promise<RouteSetting> {
  const s = RouteSettingInputSchema.parse(raw)
  const values = {
    insures: s.insures ?? null,
    insuranceBps: s.insurancePercent == null ? null : Math.round(s.insurancePercent * 100),
    insuranceMinPaise: s.insuranceMinPaise ?? null,
    costCard: s.costCard ?? null,
    enabled: s.enabled,
    showName: s.showName ?? null,
    updatedAt: new Date(),
  }
  const [row] = await tx
    .insert(deliveryRouteSetting)
    .values({ storeId, key: s.key, ...values })
    .onConflictDoUpdate({
      target: [deliveryRouteSetting.storeId, deliveryRouteSetting.key],
      set: values,
    })
    .returning()
  return toSetting(row as typeof deliveryRouteSetting.$inferSelect)
}

export async function deleteRouteSetting(tx: StoreTx, key: string): Promise<void> {
  await tx.delete(deliveryRouteSetting).where(eq(deliveryRouteSetting.key, key))
}

/** A cart's lines as the quote snapshot keys them: variant and quantity. */
export async function cartLineKeys(
  tx: StoreTx,
  cartId: string,
): Promise<Array<{ variantId: string; quantity: number }>> {
  return tx
    .select({ variantId: cartLine.variantId, quantity: cartLine.quantity })
    .from(cartLine)
    .where(eq(cartLine.cartId, cartId))
}

/**
 * The parcel these cart lines become, as the admin would book it: each variant's box (its own,
 * else its product's, both stored on the variant) and weight, the store's boxes for the main
 * box and packing. Lines that never ship (gift cards, no shipping) are left out. Checkout and
 * place order price couriers on its billed weight (#1546).
 */
export async function cartParcelFor(
  tx: StoreTx,
  lines: ReadonlyArray<{ variantId: string; quantity: number }>,
  boxPresets: ShippingSettings['boxPresets'],
): Promise<CartParcel> {
  const ids = [...new Set(lines.map((l) => l.variantId))]
  const rows =
    ids.length === 0
      ? []
      : await tx
          .select({
            id: variant.id,
            weightGrams: variant.weightGrams,
            boxPresetId: variant.boxPresetId,
            packageLengthCm: variant.packageLengthCm,
            packageWidthCm: variant.packageWidthCm,
            packageHeightCm: variant.packageHeightCm,
            requiresShipping: variant.requiresShipping,
            giftCard: product.isGiftCard,
          })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const shipped = lines.flatMap((l) => {
    const v = byId.get(l.variantId)
    return v && lineShips(v)
      ? [{ ...v, quantity: l.quantity, variantWeightGrams: v.weightGrams }]
      : []
  })
  return cartParcel(shipped, boxPresets)
}

/** What the route rules match on, for each product behind these variants. */
export async function cartItemFacts(
  tx: StoreTx,
  variantIds: readonly string[],
): Promise<CartItemFacts[]> {
  if (variantIds.length === 0) return []
  const rows = await tx
    .selectDistinct({ productId: variant.productId })
    .from(variant)
    .where(inArray(variant.id, [...variantIds]))
  return productFacts(
    tx,
    rows.map((r) => r.productId),
  )
}

/** The same facts for an order's lines (booking applies the rules to orders on backup). */
export async function productFacts(
  tx: StoreTx,
  productIds: readonly string[],
): Promise<CartItemFacts[]> {
  if (productIds.length === 0) return []
  const rows = await tx
    .select({
      productId: product.id,
      tags: product.tags,
      productType: product.productType,
      categoryId: product.categoryId,
    })
    .from(product)
    .where(inArray(product.id, [...productIds]))
  const members = await tx
    .select({
      productId: collectionProduct.productId,
      collectionId: collectionProduct.collectionId,
    })
    .from(collectionProduct)
    .where(inArray(collectionProduct.productId, [...productIds]))
  return rows.map((r) => ({
    productId: r.productId,
    tags: r.tags,
    productType: r.productType,
    categoryId: r.categoryId,
    collectionIds: members.filter((m) => m.productId === r.productId).map((m) => m.collectionId),
  }))
}
