import { headers } from 'next/headers'
import { permanentRedirect } from 'next/navigation'
import { MARKET_HEADERS, marketPath } from '@/lib/markets'

/** `/wishlist` is where shoppers guess it is; the wishlist page lives at `/pages/wishlist` (#204). */
export default async function WishlistRedirect() {
  const prefix = (await headers()).get(MARKET_HEADERS.prefix) ?? ''
  permanentRedirect(marketPath(prefix, '/pages/wishlist'))
}
