import { and, eq, inArray, type SQL, type SQLWrapper, sql } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { inventoryLevel, sellableLevel, variant } from './schema'

/**
 * SOURCE OF TRUTH: sellableStock, primarySellingLevel
 * WHAT:  Stock a variant sells online, summed over every location that ships online orders,
 *        one row per variant: `variantId`, `onHand`, `reserved` (available = onHand - reserved).
 * WHY:   A variant may sell from several warehouses; joining inventory_level on variant_id
 *        would return a row per location. Join this instead wherever stock is shown or checked
 *        for the whole store (storefront, cart, admin lists, reports).
 * WHERE: `.leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))`. Runs under the
 *        caller's RLS like any other query.
 */
export const sellableStock = new QueryBuilder()
  .select({
    variantId: inventoryLevel.variantId,
    onHand: sql<number>`sum(${inventoryLevel.onHand})::int`.as('on_hand'),
    reserved: sql<number>`sum(${inventoryLevel.reserved})::int`.as('reserved'),
  })
  .from(inventoryLevel)
  .where(sellableLevel)
  .groupBy(inventoryLevel.variantId)
  .as('sellable_stock')

/**
 * `sellableStock` for the variants of some products only: the same sums, filtered before the
 * grouping. Join it where a page shows a few products (the Products list's 25 rows):
 * `sellableStock` groups every selling row in the store before the join can narrow it.
 */
export const sellableStockForProducts = (productIds: string[]) =>
  new QueryBuilder()
    .select({
      variantId: inventoryLevel.variantId,
      onHand: sql<number>`sum(${inventoryLevel.onHand})::int`.as('on_hand'),
      reserved: sql<number>`sum(${inventoryLevel.reserved})::int`.as('reserved'),
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .where(and(sellableLevel, inArray(variant.productId, productIds)))
    .groupBy(inventoryLevel.variantId)
    .as('sellable_stock_page')

/**
 * Filter for the one selling row a whole-variant stock edit (the product form's "Stock") and a
 * move without a parcel use: the default location's when it sells online, else the first
 * selling location by priority.
 */
export const primarySellingLevel = (variantId: SQLWrapper | string): SQL =>
  sql`${inventoryLevel.id} = (
    select il.id from inventory_level il join location l on l.id = il.location_id
    where il.variant_id = ${variantId} and il.fulfils_online
    order by l.is_default desc, l.priority, l.id limit 1)`
