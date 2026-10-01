import { type ProductDetail, ProductRecommendations } from '@commerce/blocks'
import { listCardProducts } from '@/lib/catalog'
import { inStore } from '@/lib/store-context'

type RelatedProductsProps = {
  storeId: string
  product: ProductDetail
  heading: string
  limit: number
}

/** Products of the same type as the one being viewed, Shopify's related products fallback. */
export default async function RelatedProducts({
  storeId,
  product,
  heading,
  limit,
}: RelatedProductsProps) {
  // Hooks
  const candidates = await inStore(storeId, (tx) =>
    listCardProducts(tx, limit + 1, product.productType ?? undefined),
  )

  // Render logic
  const products = candidates.filter((p) => p.id !== product.id).slice(0, limit)
  return <ProductRecommendations heading={heading} products={products} />
}
