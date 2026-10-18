'use client'

import { createContext, use } from 'react'

/**
 * What the storefront lets a card do for the shopper (a server action under the hood). The
 * admin canvas provides nothing, so a card's buttons there are a picture and never write.
 */
export type StoreActions = {
  /** Adds one line to the shopper's cart; the header's count refreshes with the layout. */
  addToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
}

export const StoreActionsContext = createContext<StoreActions>({})

/**
 * Fired on `window` after anything adds to the cart (a card's Quick add, the product page), so
 * the storefront's cart drawer can open with the new line (Theme settings → Cart → Drawer).
 */
export const CART_ADDED_EVENT = 'commerce:cart-added'

export function announceCartAdded(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_ADDED_EVENT))
}

/** The storefront's actions, or none in the editor. */
export function useStoreActions(): StoreActions {
  return use(StoreActionsContext)
}
