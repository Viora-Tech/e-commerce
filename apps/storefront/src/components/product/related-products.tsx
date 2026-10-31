import { type ProductDetail, ProductRecommendations } from '@commerce/blocks'
import { pickedRecommendationHandlesFor } from '@commerce/core'
import { listCardProducts } from '@/lib/catalog'
import { relatedHandles } from '@/lib/related'
import { storeRead } from '@/lib/store-cache'

type RelatedProductsProps = {
  storeId: string
  product: ProductDetail
  heading: string
  limit: number
}

/**
 * Related products: the merchant's own picks first (Search & discovery), then others from the
 * product's own collections (newest first), then ones of the same type, then the newest in the
 * store, never the product itself.
 */
export default async function RelatedProducts({
  storeId,
  product,
  heading,
  limit,
}: RelatedProductsProps) {
  // Hooks
  const type = product.productType ?? undefined
  const [fromCollections, sameType] = await Promise.all([
    storeRead(storeId, `related|${product.id}|${limit}`, async (tx) => {
      const picked = await pickedRecommendationHandlesFor(tx, product.id, 'related')
      const handles = [
        ...new Set([...picked, ...(await relatedHandles(tx, product.id, limit))]),
      ].slice(0, Math.max(limit, picked.length))
      return handles.length ? listCardProducts(tx, handles.length, undefined, handles) : []
    }),
    storeRead(storeId, `card-products|${limit + 1}|${type ?? ''}`, (tx) =>
      listCardProducts(tx, limit + 1, type),
    ),
  ])

  // Render logic
  const seen = new Set<string>([product.id])
  const products = [...fromCollections, ...sameType]
    .filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)))
    .slice(0, limit)
  return <ProductRecommendations heading={heading} products={products} intent="related" />
}
