import 'server-only'
import {
  type LiquidProductData,
  type RecommendationIntent,
  resolveThemeProductId,
  storeLiquidData,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { cachedLiquidData } from './liquid-data-cache'
import { requestCatalogId } from './market-catalog'
import { requestOrigin } from './seo'

/**
 * The products Shopify's `/recommendations/products.json` lists for one product (the id a
 * theme sent: our UUID or the whole number it was shown): the same ones the theme's section
 * shows (`renderRecommendations`), read through the store cache. Null when the product is
 * unknown.
 */
export async function recommendedProducts(
  tx: StoreTx,
  storeId: string,
  input: { productId: string; limit: number; intent: RecommendationIntent },
): Promise<LiquidProductData[] | null> {
  const productId = await resolveThemeProductId(tx, input.productId)
  if (!productId) return null
  const origin = await requestOrigin()
  const source = await storeLiquidData(tx, { storeId, host: new URL(origin).host, origin })
  const catalogId = await requestCatalogId(storeId)
  return cachedLiquidData(
    storeId,
    origin,
    source,
    catalogId ? `catalog:${catalogId}` : '',
  ).relatedProducts(productId, input.limit, input.intent)
}
