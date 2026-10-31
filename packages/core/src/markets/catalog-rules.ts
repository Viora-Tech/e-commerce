/** SOURCE OF TRUTH: withCatalogPricing, combineAdjustments, CatalogPricing, CATALOG_SETTING, soldInRequestCatalog
 * WHAT:  The pure half of Markets › Catalogs: a market's pricing with its catalog's price
 *        changes on top, and the SQL test "is this product sold in the request's catalog".
 * WHY:   One rule for every price a shopper abroad sees (store, cart, checkout summary), and one
 *        predicate every storefront listing adds, so a catalog hides the same products everywhere.
 */
import type { MarketPricing } from '@commerce/money'
import { type AnyColumn, type SQL, sql } from 'drizzle-orm'

/** What a market's active catalog changes about its prices. */
export type CatalogPricing = {
  /** Basis points on top of the market's own adjustment: -1000 is 10% off. */
  adjustmentBp: number
  /** Fixed prices in the market's currency minor units, by variant id. */
  fixedMinor: Readonly<Record<string, number>>
}

/** Two adjustments one after the other, as one: +10% then -10% is -1%, not 0. */
export function combineAdjustments(marketBp: number, catalogBp: number): number {
  return marketBp + catalogBp + (marketBp * catalogBp) / 10_000
}

/**
 * A market's pricing with its catalog on top: the catalog's percent after the market's own
 * adjustment, then the market's rounding; fixed prices as typed. A rupee market keeps its
 * pricing as it is: its checkout charges the product's own price, so a catalog there only
 * chooses products (the admin refuses price changes for one).
 */
export function withCatalogPricing(
  base: MarketPricing | null,
  catalog: CatalogPricing | null,
): MarketPricing | null {
  if (!base || !catalog || base.currency === 'INR') return base
  const hasFixed = Object.keys(catalog.fixedMinor).length > 0
  if (catalog.adjustmentBp === 0 && !hasFixed) return base
  return {
    ...base,
    adjustmentBp: combineAdjustments(base.adjustmentBp, catalog.adjustmentBp),
    ...(hasFixed ? { fixedMinor: catalog.fixedMinor } : {}),
  }
}

/**
 * The transaction setting that names the request's catalog when it sells chosen products only.
 * The storefront sets it per request (`inStore`); unset or empty, every product is sold.
 */
const CATALOG_SETTING = 'app.catalog_id'

/**
 * True when the product is sold in the request's catalog (`app.catalog_id`): always without
 * one; else when the catalog names it, or one of its collections holds it. Every storefront
 * listing, search and recommendation adds this, so a catalog hides the same products everywhere.
 */
export function soldInRequestCatalog(productId: AnyColumn | SQL): SQL {
  const current = sql`nullif(current_setting(${sql.raw(`'${CATALOG_SETTING}'`)}, true), '')`
  return sql`(${current} is null or ${productId} in (
    select cp.product_id from catalog_product cp where cp.catalog_id = ${current}::uuid
    union
    select col.product_id from catalog_collection cc
      join collection_product col on col.collection_id = cc.collection_id
     where cc.catalog_id = ${current}::uuid))`
}
