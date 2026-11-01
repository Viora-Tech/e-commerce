'use client'

import { CART_ADDED_EVENT } from '@commerce/blocks'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type ThemeCartAddedProps = {
  /** The cart page in the shopper's market (`/cart`, `/ae/cart`). */
  cartHref: string
}

/**
 * Under an imported theme, an add to cart from our product form opens the cart page, as the
 * theme's own adds do (`lib/liquid-shim.ts`). Without it the add only changed the header's
 * count: the theme's drawer is not wired to our cart, and our drawer belongs to our themes.
 */
export default function ThemeCartAdded({ cartHref }: ThemeCartAddedProps) {
  // Hooks
  const router = useRouter()
  useEffect(() => {
    const open = () => router.push(cartHref)
    window.addEventListener(CART_ADDED_EVENT, open)
    return () => window.removeEventListener(CART_ADDED_EVENT, open)
  }, [cartHref, router])

  return null
}
