/** SOURCE OF TRUTH: order card thumbnails — WHAT: each product's first picture, line order, at most three / WHY: Figma 705:114276 order cards, testable without a database */

/** How many product pictures an order card shows. */
const ORDER_THUMBNAILS = 3

/**
 * Each product's first picture (images arrive sorted by position), in the order its lines
 * list the products, at most `max`. A product without a picture is skipped, never a grey box.
 */
export function orderThumbnails(
  productIds: string[],
  images: { productId: string; url: string; alt: string | null }[],
  max = ORDER_THUMBNAILS,
): { url: string; alt: string | null }[] {
  const out: { url: string; alt: string | null }[] = []
  for (const id of new Set(productIds)) {
    const img = images.find((i) => i.productId === id)
    if (img) out.push({ url: img.url, alt: img.alt })
    if (out.length >= max) break
  }
  return out
}
