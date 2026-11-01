/**
 * Current stock of every variant, and nothing else. A stock change on Shopify
 * does not move the product's `updated_at`, so an import that reuses a
 * preview's products (plus the products changed since) reads stock fresh with
 * this one light, paged query instead of trusting the preview's numbers.
 */
import type { ShopifyClient } from './shopify-client'
import type { NProduct } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
type GStock = {
  id: string
  inventoryQuantity: number | null
  inventoryItem: { tracked: boolean } | null
}

const VARIANT_STOCK_QUERY = `query VariantStock($cursor: String) {
  productVariants(first: 200, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { id inventoryQuantity inventoryItem { tracked } }
  }
}`

/** Shopify variant id → on hand (null when Shopify does not track it), the way `mapVariant` reads it. */
async function fetchVariantStock(client: ShopifyClient): Promise<Map<string, number | null>> {
  const stock = new Map<string, number | null>()
  for await (const nodes of client.paginate<GStock>(
    VARIANT_STOCK_QUERY,
    (d) => (d as { productVariants: Page<GStock> }).productVariants,
    {},
    420,
  )) {
    for (const v of nodes) {
      stock.set(
        v.id,
        // Negative means oversold: the units still owed, kept as on Shopify (audit #53).
        v.inventoryItem?.tracked === false ? null : (v.inventoryQuantity ?? 0),
      )
    }
  }
  return stock
}

/**
 * Read every variant's stock once (ids and numbers only, small next to the
 * products), then return what overwrites a batch of products with it, in place.
 */
export async function stockRefresher(
  client: ShopifyClient,
): Promise<(products: NProduct[]) => void> {
  const stock = await fetchVariantStock(client)
  return (products) => {
    for (const p of products) {
      for (const v of p.variants) {
        if (v.sourceId && stock.has(v.sourceId)) v.onHand = stock.get(v.sourceId) ?? null
      }
    }
  }
}
