import type { ProductDetail } from './types'

/**
 * Whether the picked variant sells as a pre-order right now: the product has pre-order on, the
 * variant allows it (per variant, Shopify's "continue selling when out of stock") and it is out
 * of stock. With no variant picked, the product's switch alone decides.
 */
export function variantOnPreorder(
  product: Pick<ProductDetail, 'preorder'>,
  variant: Pick<ProductDetail['variants'][number], 'available' | 'preorder'> | undefined,
): boolean {
  if (!product.preorder?.enabled) return false
  if (!variant) return true
  return variant.preorder !== false && variant.available <= 0
}
