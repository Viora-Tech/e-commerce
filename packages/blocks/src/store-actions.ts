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

/** The storefront's actions, or none in the editor. */
export function useStoreActions(): StoreActions {
  return use(StoreActionsContext)
}
