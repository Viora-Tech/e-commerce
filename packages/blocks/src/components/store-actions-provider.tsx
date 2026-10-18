'use client'

import type { ReactNode } from 'react'
import { announceCartAdded, type StoreActions, StoreActionsContext } from '../store-actions'

/** Wraps the storefront page so product cards can add to the cart. */
export default function StoreActionsProvider({
  addToCart,
  children,
}: StoreActions & { children: ReactNode }) {
  // Every add from a card tells the cart drawer, which opens when the theme uses one.
  const add = addToCart
    ? async (variantId: string, quantity: number) => {
        await addToCart(variantId, quantity)
        announceCartAdded()
      }
    : undefined
  return <StoreActionsContext value={{ addToCart: add }}>{children}</StoreActionsContext>
}
