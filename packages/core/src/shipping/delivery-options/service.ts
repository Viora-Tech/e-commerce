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
import { parseAppsSettings } from '../../apps/settings'
import {
  CostCardSchema,
  DELIVERY_OPTIONS_APP_ID,
  type DeliveryConfig,
  type DeliveryOption,
  DeliveryOptionInputSchema,
  PRESET_OPTIONS,
  type RouteRule,
  RouteRuleInputSchema,
  type RouteSetting,
  RouteSettingInputSchema,
} from './config'
import type { CartItemFacts } from './rules'

/** Whether the store installed the app. Options without the app change nothing. */
export async function deliveryOptionsInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps).installed.includes(DELIVERY_OPTIONS_APP_ID)
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
  }
}

/** Everything the engine reads. `version` changes whenever any of it does. */
export async function loadDeliveryConfig(tx: StoreTx): Promise<DeliveryConfig> {
  const [options, rules, settings] = await Promise.all([
    tx.select().from(deliveryOption).orderBy(asc(deliveryOption.position), asc(deliveryOption.id)),
    tx
      .select()
      .from(deliveryRouteRule)
      .orderBy(asc(deliveryRouteRule.position), asc(deliveryRouteRule.id)),
    tx.select().from(deliveryRouteSetting).orderBy(asc(deliveryRouteSetting.key)),
  ])
  const config = {
    options: options.flatMap((r) => toOption(r) ?? []),
    rules: rules.flatMap((r) => toRule(r) ?? []),
    routeSettings: settings.map(toSetting),
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
  const config = await loadDeliveryConfig(tx)
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
    .select({ productId: product.id, tags: product.tags, productType: product.productType })
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
    collectionIds: members.filter((m) => m.productId === r.productId).map((m) => m.collectionId),
  }))
}
