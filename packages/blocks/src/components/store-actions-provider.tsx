'use client'

import type { ReactNode } from 'react'
import { type StoreActions, StoreActionsContext } from '../store-actions'

/** Wraps the storefront page so product cards can add to the cart. */
export default function StoreActionsProvider({
  addToCart,
  children,
}: StoreActions & { children: ReactNode }) {
  return <StoreActionsContext value={{ addToCart }}>{children}</StoreActionsContext>
}
