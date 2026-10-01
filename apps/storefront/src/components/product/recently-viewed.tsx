import { ProductRecommendations } from '@commerce/blocks'
import { cookies } from 'next/headers'
import { listCardProducts } from '@/lib/catalog'
import { parseRecentlyViewed, RECENTLY_VIEWED_COOKIE } from '@/lib/recently-viewed'
import { inStore } from '@/lib/store-context'

type RecentlyViewedProps = {
  storeId: string
  /** The product on screen, left out of its own row. */
  exclude?: string | undefined
  heading: string
  limit: number
}

/** The shopper's recently viewed products, newest first, from the product page cookie. */
export default async function RecentlyViewed({
  storeId,
  exclude,
  heading,
  limit,
}: RecentlyViewedProps) {
  // Hooks
  const jar = await cookies()
  const handles = parseRecentlyViewed(jar.get(RECENTLY_VIEWED_COOKIE)?.value)
    .filter((h) => h !== exclude)
    .slice(0, limit)
  const products = await inStore(storeId, (tx) => listCardProducts(tx, limit, undefined, handles))

  // Render logic
  return <ProductRecommendations heading={heading} products={products} />
}
