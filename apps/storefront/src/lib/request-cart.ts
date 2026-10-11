import 'server-only'
import { getCart } from '@commerce/core'
import { cache } from 'react'
import { readCartId } from './cart-cookie'
import { inStore } from './store-context'

/**
 * The shopper's cart, read once per request (the header's count, the imported theme's cart
 * drawer and the render cache's "is the cart empty" all ask). Null without a cart cookie.
 */
export const requestCart = cache(async (storeId: string) => {
  const cartId = await readCartId()
  return cartId ? inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
})

/** True when the shopper has no cart or nothing in it; needs no query without a cart cookie. */
export async function cartIsEmpty(storeId: string): Promise<boolean> {
  return ((await requestCart(storeId))?.itemCount ?? 0) === 0
}
